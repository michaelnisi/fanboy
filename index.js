'use strict'

// fanboy - search itunes store

exports = module.exports = Fanboy

const JSONStream = require('JSONStream')
const StringDecoder = require('string_decoder').StringDecoder
const events = require('events')
const http = require('http')
const https = require('https')
const keys = require('./lib/keys')
const levelup = require('levelup')
const lr = require('level-random')
const lru = require('lru-cache')
const querystring = require('querystring')
const stream = require('readable-stream')
const util = require('util')

const debug = util.debuglog('fanboy')

const TEST = process.mainModule.filename.match(/test/) !== null

function nop () {}

function guid (obj) {
  obj.guid = obj.collectionId
  return obj
}

function Opts (
  cache = { set: nop, get: nop, reset: nop },
  cacheSize = 8 * 1024 * 1024,
  country = 'us',
  highWaterMark,
  hostname = 'itunes.apple.com',
  max = 500,
  media = 'all',
  objectMode = false,
  path = '/search',
  port = 80,
  result = guid,
  ttl = 24 * 36e5
) {
  this.cache = cache
  this.cacheSize = cacheSize
  this.country = country
  this.result = result
  this.highWaterMark = highWaterMark
  this.hostname = hostname
  this.max = max
  this.media = media
  this.objectMode = objectMode
  this.path = path
  this.port = port
  this.ttl = ttl
}

function defaults (opts = Object.create(null)) {
  return new Opts(
    opts.cache,
    opts.cacheSize,
    opts.country,
    opts.highWaterMark,
    opts.hostname,
    opts.max,
    opts.media,
    opts.objectMode,
    opts.path,
    opts.port,
    opts.result,
    opts.ttl
  )
}

function sharedState (opts) {
  opts.cache = lru({ maxAge: opts.ttl, max: opts.max })
  return opts
}

function Fanboy (name, opts) {
  if (!(this instanceof Fanboy)) return new Fanboy(name, opts)
  events.EventEmitter.call(this)
  opts = defaults(opts)
  this.db = levelup(name, {
    cacheSize: opts.cacheSize
  })
  this.opts = sharedState(opts)
}
util.inherits(Fanboy, events.EventEmitter)

Fanboy.prototype.search = function (limit) {
  return new Search(this.db, this.opts, limit)
}

Fanboy.prototype.lookup = function () {
  return new Lookup(this.db, this.opts)
}

Fanboy.prototype.suggest = function (limit) {
  return new SearchTerms(this.db, this.opts, limit)
}

if (TEST) {
  Fanboy.prototype.close = function (cb) {
    this.db.close(cb)
  }
}

function TransformOpts (highWaterMark) {
  this.highWaterMark = highWaterMark
}

function FanboyTransform (db, opts, limit) {
  if (!(this instanceof FanboyTransform)) {
    return new FanboyTransform(db, opts)
  }
  this.db = db
  this.limit = limit

  if (!(opts instanceof Opts)) {
    opts = defaults(opts)
  }

  const sopts = new TransformOpts(opts.highWaterMark)
  stream.Transform.call(this, sopts)

  Object.assign(this, opts)
  this.decoder = new StringDecoder()
  this.state = 0
  this._readableState.objectMode = opts.objectMode
}
util.inherits(FanboyTransform, stream.Transform)

FanboyTransform.prototype.decode = function (chunk) {
  return this.decoder.write(chunk).toLowerCase()
}

const TOKENS = ['[', ',', ']\n']
FanboyTransform.prototype.use = function (chunk) {
  if (this._readableState.objectMode) {
    let obj = null
    try {
      obj = JSON.parse(chunk)
    } catch (error) {
      const er = new Error('fanboy: cannot use: ' + error.message)
      this.emit('error', er)
      return true
    }
    return obj !== null ? this.push(obj) : true
  } else {
    const more = this.push(TOKENS[this.state] + chunk)
    this.state = 1
    return more
  }
}

FanboyTransform.prototype.deinit = function () {
  this.cache = null
  this.db = null
  this.result = null
}

FanboyTransform.prototype._flush = function (cb) {
  if (!this._readableState.objectMode) {
    this.push(this.state ? TOKENS[2] : '[]\n')
    this.state = 0
  }
  this.deinit()
  cb()
}

// Bulk-write operation
function Bulk (type, key, value) {
  this.type = type
  this.key = key
  this.value = value
}

function termOp (term, kees, now) {
  now = now || Date.now()
  const k = keys.termKey(term)
  const v = JSON.stringify([now].concat(kees))
  return new Bulk('put', k, v)
}

function resOp (result, now) {
  now = now || Date.now()
  result.ts = now
  const k = keys.resKey(result.guid)
  const v = JSON.stringify(result)
  return new Bulk('put', k, v)
}

function putOps (term, results, now) {
  const ops = []
  const keys = results.map((result) => {
    const op = resOp(result, now)
    ops.push(op)
    return op.key
  })
  ops.push(termOp(term, keys, now))
  return ops
}

function put (db, term, results, cb) {
  if (results && results.length) {
    db.batch(putOps(term, results), cb)
  } else {
    cb(new Error('fanboy: cannot store empty results'))
  }
}

function del (db, term, cb) {
  db.del(keys.termKey(term), cb)
}

const verbs = { '/search': 'term', '/lookup': 'id' }
function decorate (obj, path, term) {
  obj[verbs[path]] = term
  return obj
}

function mkpath (path, term, media, country) {
  const obj = path === '/lookup' ? Object.create(null) : {
    media: media,
    country: country
  }
  const q = querystring.stringify(decorate(obj, path, term))
  return [path, q].join('?')
}

function ReqOpts (hostname, keepAlive, port, method, path) {
  this.hostname = hostname
  this.keepAlive = keepAlive
  this.method = method
  this.path = path
  this.port = port
}

FanboyTransform.prototype.reqOpts = function (term) {
  term = term || this.term

  // Anecdotally, it appears that the country selector doesn’t make any difference.

  const p = mkpath(this.path, term, this.media, this.country)
  return new ReqOpts(this.hostname, true, this.port, 'GET', p)
}

function parse (readable) {
  const parser = JSONStream.parse('results.*')
  function onerror (er) {
    debug(er)
    parser.end()
    onend()
  }
  function onend () {
    parser.removeListener('end', onend)
    parser.removeListener('error', onerror)
    readable.unpipe()
  }
  parser.on('end', onend)
  parser.on('error', onerror)
  return readable.pipe(parser)
}

// Request lookup or search for term.
//
// - term String iTunes ID or search term.
// - keys [String] Array of cached keys (optional).
FanboyTransform.prototype.request = function (term, keys, cb) {
  if (typeof keys === 'function') {
    cb = keys
    keys = null
  }
  let skip = () => {
    return this.cache.has(term)
  }
  if (skip()) {
    return cb()
  }

  const opts = this.reqOpts(term)
  debug(opts)

  let fallback = () => {
    if (skip()) return cb()
    if (keys) {
      return this.resultsForKeys(keys, cb)
    }
    this.keysForTerm(term, (er, keys) => {
      if (er) {
        return cb(er.notFound ? null : er)
      }
      this.resultsForKeys(keys, cb)
    })
  }

  const mod = opts.port === 443 ? https : http
  let req = mod.request(opts, (res) => {
    const statusCode = res.statusCode
    if (statusCode !== 200) {
      res.once('end', () => {
        const er = new Error('fanboy: unexpected response ' + statusCode)
        er.statusCode = statusCode
        er.headers = res.headers
        util._extend(er, opts)
        this.emit('error', er)
        cb()
      })
      return res.resume()
    }
    const parser = parse(res)
    function ondrain () {
      parser.resume()
    }
    const results = []
    let ondata = (obj) => {
      const result = this.result(obj)
      if (result) {
        results.push(result)
        const chunk = JSON.stringify(result)
        if (!this.use(chunk)) {
          parser.pause()
          this.on('drain', ondrain)
        }
      }
    }
    let ok = true
    let onend = () => {
      if (results.length) {
        put(this.db, term, results, (er) => {
          done(er)
        })
      } else if (ok) {
        const cache = this.cache
        del(this.db, term, (er) => {
          cache.set(term, true)
          done(er)
        })
      } else {
        done()
      }
    }
    function onerror (error) {
      ok = false
      const er = new Error('fanboy: parse error: ' + error.message)
      done(er)
    }
    let done = (er) => {
      if (!cb) return
      this.removeListener('drain', ondrain)
      parser.removeListener('data', ondata)
      parser.removeListener('end', onend)
      parser.removeListener('error', onerror)
      cb(er)
    }
    parser.on('data', ondata)
    parser.on('end', onend)
    parser.on('error', onerror)
  })
  let onRequestError = (error) => {
    req.removeListener('error', onRequestError)
    const er = util._extend(new Error(), error)
    er.message = 'fanboy: ' + error.message
    if (keys) {
      er.message = 'fanboy: falling back on cache ' + er.code
      this.emit('error', er)
      return fallback()
    }
    cb(er)
  }
  function onRequestEnd () {
    req.removeListener('error', onRequestError)
    req.removeListener('end', onRequestEnd)
    req = null
  }
  req.on('error', onRequestError)
  req.on('end', onRequestEnd)
  req.end()
}

FanboyTransform.prototype.toString = function () {
  return 'fanboy: ' + this.constructor.name
}

// Lookup item in store
function Lookup (db, opts) {
  if (!(this instanceof Lookup)) return new Lookup(db, opts)
  opts = opts || Object.create(null)
  opts.path = '/lookup'
  FanboyTransform.call(this, db, opts)
}
util.inherits(Lookup, FanboyTransform)

// The result as JSON string
// - db levelup()
// - id the iTunes ID
// - cb cb(er, value)
function resultForID (db, id, cb) {
  const key = keys.resKey(id)
  db.get(key, (er, value) => {
    cb(er, value)
  })
}

// - chunk iTunes ID (e.g. '537879700')
Lookup.prototype._transform = function (chunk, enc, cb) {
  if (this.db.isClosed()) {
    return cb(new Error('fanboy: database closed'))
  }

  const db = this.db
  const guid = this.decode(chunk)

  if (!parseInt(guid, 10)) {
    return cb(new Error('fanboy: guid ' + guid + ' is not a number'))
  }

  resultForID(db, guid, (er, value) => {
    if (er) {
      if (er.notFound) {
        return this.request(guid, cb)
      }
    } else if (value !== undefined) {
      this.use(value)
    }
    cb(er)
  })
}

function Search (db, opts) {
  if (!(this instanceof Search)) return new Search(db, opts)
  if (opts) opts.path = '/search'
  FanboyTransform.call(this, db, opts)
}
util.inherits(Search, FanboyTransform)

function isStale (time, ttl) {
  return Date.now() - time > ttl
}

Search.prototype.keysForTerm = function (term, cb) {
  const ttl = this.ttl
  const limit = this.limit

  this.db.get(keys.termKey(term), { limit }, (er, value) => {
    let keys
    if (!er && !!value) {
      try {
        keys = JSON.parse(value)
        if (isStale(keys.shift(), ttl)) {
          er = new Error('fanboy: stale keys for ' + term)
          er.notFound = true
        }
      } catch (ex) {
        er = ex
      }
    }
    cb(er, keys)
  })
}

function LROpts (db) {
  this.db = db
  this.fillCache = true
  this.errorIfNotExists = true
}

Search.prototype.resultsForKeys = function (keys, cb) {
  const s = lr(new LROpts(this.db))
  let read = () => {
    if (this._writableState.needDrain) return
    let ok = true
    let chunk
    while (ok && (chunk = s.read()) !== null) {
      ok = this.use(chunk)
    }
    if (!ok) {
      this.once('drain', read)
    } else {
      this.removeListener('drain', read)
    }
  }
  const notFound = []
  function onerror (error) {
    if (error.notFound) {
      notFound.push(error)
    } else {
      const er = new Error('fanboy: ' + error.message)
      done(er)
    }
  }
  function write () {
    let ok = false
    let chunk
    while ((chunk = keys.shift())) {
      ok = s.write(chunk)
    }
    if (!ok && keys.length > 0) {
      s.once('drain', write)
    } else {
      s.removeListener('drain', write)
      s.end()
    }
  }
  function onend () {
    let er
    const inconsistent = notFound.length > 0
    if (inconsistent) {
      er = new Error('fanboy: inconsistent database')
      er.reason = notFound
    }
    done(er)
  }
  s.on('end', onend)
  s.on('error', onerror)
  s.on('readable', read)
  function done (er) {
    if (!cb) return
    s.removeListener('end', onend)
    s.removeListener('error', onerror)
    s.removeListener('readable', read)
    cb(er)
  }
  write()
}

Search.prototype._transform = function (chunk, enc, cb) {
  if (this.db.isClosed()) {
    return cb(new Error('fanboy: database closed'))
  }
  const term = this.decode(chunk)
  this.keysForTerm(term, (er, keys) => {
    if (er) {
      if (er.notFound) {
        this.request(term, keys, cb)
      } else {
        cb(er)
      }
    } else {
      this.resultsForKeys(keys, cb)
    }
  })
}

// Suggest search terms
function SearchTerms (db, opts) {
  if (!(this instanceof SearchTerms)) return new SearchTerms(db, opts)
  FanboyTransform.call(this, db, opts)
}
util.inherits(SearchTerms, FanboyTransform)

function keyStream (db, term, limit) {
  return db.createKeyStream(keys.rangeForTerm(term, limit))
}

SearchTerms.prototype._transform = function (chunk, enc, cb) {
  if (this.db.isClosed()) {
    return cb(new Error('fanboy: database closed'))
  }

  const term = this.decode(chunk)
  const reader = keyStream(this.db, term, this.limit)

  const read = () => {
    let chunk
    let ok
    let sug

    do {
      chunk = reader.read()
      if (chunk) {
        sug = keys.termFromKey(chunk)
        ok = this.use('"' + sug + '"')
      }
    } while (chunk && ok)
    if (ok === false) {
      this.once('drain', read)
    }
  }

  function onerror (error) {
    const er = new Error('fanboy: failed to stream keys: ' + error.message)
    er.term = term
    done(er)
  }

  function done (er) {
    if (!cb) return
    reader.removeListener('drain', read)
    reader.removeListener('end', done)
    reader.removeListener('error', onerror)
    reader.removeListener('readable', read)
    cb(er)
  }

  reader.on('end', done)
  reader.on('error', onerror)
  reader.on('readable', read)
}

if (TEST) {
  exports.base = FanboyTransform
  exports.debug = debug
  exports.defaults = defaults
  exports.guid = guid
  exports.isStale = isStale
  exports.keyStream = keyStream
  exports.lookup = Lookup
  exports.nop = nop
  exports.parse = parse
  exports.putOps = putOps
  exports.resOp = resOp
  exports.search = Search
  exports.suggest = SearchTerms
  exports.termOp = termOp
}
