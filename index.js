'use strict'

exports = module.exports = Fanboy

const JSONStream = require('JSONStream')
const StringDecoder = require('string_decoder').StringDecoder
const events = require('events')
const http = require('http')
const https = require('https')
const lru = require('lru-cache')
const querystring = require('querystring')
const stream = require('readable-stream')
const util = require('util')

const {
  createDatabase,
  close,
  del,
  put,
  resultForID,
  keysForTerm,
  isStale,
  keyStream,
  createLevelRandom,
  termFromKey,
  termOp,
  resOp,
  putOps
} = require('./lib/level')

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

// API

function Fanboy (name, opts) {
  if (!(this instanceof Fanboy)) return new Fanboy(name, opts)
  events.EventEmitter.call(this)
  opts = defaults(opts)
  this.db = createDatabase(name, opts.cacheSize)
  this.opts = sharedState(opts)
}
util.inherits(Fanboy, events.EventEmitter)

Fanboy.prototype.search = function () {
  return new Search(this.db, this.opts)
}

Fanboy.prototype.lookup = function () {
  return new Lookup(this.db, this.opts)
}

Fanboy.prototype.suggest = function (limit) {
  return new SearchTerms(this.db, this.opts, limit)
}

// --

if (TEST) {
  Fanboy.prototype.close = function (cb) {
    close(this.db, cb)
  }
}

function TransformOpts (highWaterMark) {
  this.highWaterMark = highWaterMark
}

function FanboyTransform (db, opts) {
  if (!(this instanceof FanboyTransform)) {
    return new FanboyTransform(db, opts)
  }
  this.db = db

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

const verbs = { '/search': 'term', '/lookup': 'id' }
function decorate (obj, path, term) {
  obj[verbs[path]] = term
  return obj
}

function mkpath (path, term, media, country, attribute) {
  const obj = (() => {
    if (path === '/lookup') return Object.create(null)
    const o = {
      media: media,
      country: country
    }
    if (attribute) o.attribute = attribute
    return o
  })()

  // Note: URL encoding replaces spaces with the plus (+) character and all
  // characters except the following are encoded: letters, numbers, periods
  // (.), dashes (-), underscores (_), and asterisks (*).

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

// Request lookup iTunes ID or search for term. Optional `keys` are used as
// fallback.
//
// - term String iTunes ID or search term.
// - keys [String] Array of cached keys (optional).
FanboyTransform.prototype._request = function (term, keys, cb) {
  if (typeof keys === 'function') {
    cb = keys
    keys = null
  }

  const skip = () => {
    const y = this.cache.has(term)
    if (y) debug('skipping: %s', term)
    return y
  }

  if (skip()) {
    return cb()
  }

  const opts = this.reqOpts(term)
  debug(opts)

  const fallback = () => {
    debug('falling back')
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

  const onresponse = (res) => {
    const statusCode = res.statusCode
    debug(statusCode)

    if (statusCode !== 200) {
      const er = new Error('fanboy: unexpected response ' + statusCode)
      er.statusCode = statusCode
      er.headers = res.headers
      Object.assign(er, opts)

      // We have to consume the response body to free up memory.
      res.resume()

      // Keeping the stream alive, I can’t remember why exactly.
      this.emit('error', er)

      return done()
    }

    // Parsing

    const parser = parse(res)
    const results = []

    function ondrain () {
      parser.resume()
    }
    const ondata = (obj) => {
      const result = this.result(obj)
      if (result) {
        results.push(result)
        const chunk = JSON.stringify(result)
        if (!this.use(chunk)) {
          parser.pause()
          this.once('drain', ondrain)
        }
      }
    }
    let faulty = false
    const onend = () => {
      if (results.length) {
        put(this.db, term, results, (er) => {
          parsed(er)
        })
      } else if (!faulty) {
        del(this.db, term, (er) => {
          this.cache.set(term, true)
          parsed(er)
        })
      } else {
        parsed()
      }
    }
    function onerror (error) {
      faulty = true
      const er = new Error('fanboy: parse error: ' + error.message)
      parsed(er)
    }
    const parsed = (er) => {
      this.removeListener('drain', ondrain)
      parser.removeListener('data', ondata)
      parser.removeListener('end', onend)
      parser.removeListener('error', onerror)
      done(er)
    }

    parser.on('data', ondata)
    parser.once('end', onend)
    parser.once('error', onerror)
  }

  // Requesting

  const req = mod.request(opts, onresponse)

  const done = (er) => {
    req.removeListener('aborted', onaborted)
    req.removeListener('error', onerror)
    req.removeListener('response', onresponse)

    if (er) {
      if (keys) {
        er.message = 'fanboy: falling back on cache'
        this.emit('error', er)
        return fallback()
      }
    }

    if (cb) cb(er)
  }

  function onaborted () {
    const er = new Error('fanboy: request aborted')
    done(er)
  }

  function onerror (error) {
    const er = Object.assign(new Error(), error)
    er.message = 'fanboy: ' + error.message
    done(er)
  }

  req.once('aborted', onaborted)
  req.once('error', onerror)

  req.end()
}

FanboyTransform.prototype.toString = function () {
  return 'fanboy: ' + this.constructor.name
}

// Lookup item in store
function Lookup (db, opts) {
  if (!(this instanceof Lookup)) return new Lookup(db, opts)
  FanboyTransform.call(this, db, opts)
  this.path = '/lookup'
}
util.inherits(Lookup, FanboyTransform)

// - chunk iTunes ID (e.g. '537879700')
Lookup.prototype._transform = function (chunk, enc, cb) {
  if (this.db.isClosed()) {
    return cb(new Error('fanboy: database closed'))
  }

  const db = this.db
  const guid = this.decode(chunk)

  debug('looking up: %s', guid)

  if (!parseInt(guid, 10)) {
    this.emit('error', new Error('fanboy: guid ' + guid + ' is not a number'))
    return cb()
  }

  resultForID(db, guid, (er, value) => {
    if (er) {
      if (er.notFound) {
        return this._request(guid, cb)
      }
    } else if (value !== undefined) {
      this.use(value)
    }
    cb(er)
  })
}

function Search (db, opts) {
  if (!(this instanceof Search)) return new Search(db, opts)
  FanboyTransform.call(this, db, opts)
  this.path = '/search'
}
util.inherits(Search, FanboyTransform)

Search.prototype.keysForTerm = function (term, cb) {
  keysForTerm(this.db, term, this.ttl, cb)
}

Search.prototype.resultsForKeys = function (keys, cb) {
  const s = createLevelRandom(this.db)

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
  s.once('end', onend)
  s.on('error', onerror)
  s.on('readable', read)
  function done (er) {
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
  debug('searching: %s', term)

  this.keysForTerm(term, (er, keys) => {
    if (er) {
      if (er.notFound) {
        this._request(term, keys, cb)
      } else {
        cb(er)
      }
    } else {
      this.resultsForKeys(keys, cb)
    }
  })
}

// Suggest search terms
function SearchTerms (db, opts, limit) {
  if (!(this instanceof SearchTerms)) return new SearchTerms(db, opts, limit)
  FanboyTransform.call(this, db, opts)
  this.limit = limit
}
util.inherits(SearchTerms, FanboyTransform)

SearchTerms.prototype._transform = function (chunk, enc, cb) {
  if (this.db.isClosed()) {
    return cb(new Error('fanboy: database closed'))
  }

  const term = this.decode(chunk)
  debug('suggesting: %s', term)

  const reader = keyStream(this.db, term, this.limit)

  const read = () => {
    let chunk
    let ok
    let sug

    do {
      chunk = reader.read()
      if (chunk) {
        sug = termFromKey(chunk)
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

  reader.once('end', done)
  reader.once('error', onerror)
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
  exports.mkpath = mkpath
  exports.nop = nop
  exports.parse = parse
  exports.putOps = putOps
  exports.resOp = resOp
  exports.search = Search
  exports.suggest = SearchTerms
  exports.termOp = termOp
}
