
// fanboy - search itunes store

exports = module.exports = Fanboy

var JSONStream = require('JSONStream')
var assert = require('assert')
var events = require('events')
var gridlock = require('gridlock')
var http = require('http')
var https = require('https')
var keys = require('./lib/keys')
var lr = require('level-random')
var lru = require('lru-cache')
var querystring = require('querystring')
var reduce = require('./lib/reduce')
var stream = require('readable-stream')
var string_decoder = require('string_decoder')
var url = require('url')
var util = require('util')

function nop () {}

var debug = function () {
  return process.env.NODE_DEBUG ?
    function (o) {
      console.error('**fanboy: %s', util.inspect(o))
    } : nop
}()

function Opts (opts) {
  opts = opts || Object.create(null)
  this.cache = opts.cache || { set:nop, get:nop, reset:nop }
  this.country = opts.country || 'us'
  this.db = opts.db
  this.encoding = opts.encoding
  this.highWaterMark = opts.highWaterMark
  this.hostname = opts.hostname || 'itunes.apple.com'
  this.locker = opts.locker || { lock:nop, unlock:nop }
  this.max = opts.max || 500
  this.media = opts.media || 'all'
  this.method = opts.method || 'GET'
  this.path = opts.path || '/search'
  this.port = opts.port || 80
  this.readableObjectMode = opts.readableObjectMode
  this.reduce = opts.reduce || reduce
  this.ttl = opts.ttl || 24 * 60 * 60 * 1000
}

function defaults (opts) {
  return new Opts(opts)
}

function Fanboy (opts) {
  if (!(this instanceof Fanboy)) return new Fanboy(opts)
  opts = defaults(opts)
  opts.locker = gridlock()
  opts.cache = lru({ maxAge:opts.ttl, max: opts.max })
  this.opts = opts
}

Fanboy.prototype.search = function () {
  return new Search(this.opts)
}

Fanboy.prototype.lookup = function () {
  return new Lookup(this.opts)
}

Fanboy.prototype.suggest = function () {
  return new SearchTerms(this.opts)
}

util.inherits(FanboyTransform, stream.Transform)
function FanboyTransform (opts) {
  opts = defaults(opts)
  if (!(this instanceof FanboyTransform)) return new FanboyTransform(opts)
  stream.Transform.call(this, opts)
  util._extend(this, opts)
  this._readableState.objectMode = opts.readableObjectMode
  this.decoder = new string_decoder.StringDecoder()
  this.state = 0
}

FanboyTransform.prototype.decode = function (chunk) {
  return this.decoder.write(chunk).toLowerCase()
}

var TOKENS = ['[', ',', ']\n']
FanboyTransform.prototype.use = function (chunk) {
  if (this._readableState.objectMode) {
    var obj = null
    try {
      obj = JSON.parse(chunk)
    } catch (er) {
      this.emit('error', er)
      return true
    }
    return obj !== null ? this.push(obj) : true
  } else {
    var more = this.push(TOKENS[this.state] + chunk)
    this.state = 1
    return more
  }
}

FanboyTransform.prototype.deinit = function () {
  this.cache = null
  this.db = null
  this.locker = null
  this.reduce = null
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
  var k = keys.termKey(term)
  var v = JSON.stringify([now].concat(kees))
  return new Bulk('put', k, v)
}

function resOp (result, now) {
  now = now || Date.now()
  result.ts = now
  var k = keys.resKey(result.guid)
  var v = JSON.stringify(result)
  return new Bulk('put', k, v)
}

function putOps (term, results, now) {
  var op
  var ops = []
  var keys = results.map(function (result) {
    op = resOp(result, now)
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
    cb(new Error('I will not store empty results'))
  }
}

function del (db, term, cb) {
  db.del(keys.termKey(term), cb)
}

var verbs = { '/search':'term', '/lookup':'id' }
function decorate (obj, path, term) {
  obj[verbs[path]] = term
  return obj
}

function mkpath (path, term, media, country) {
  var obj = {
    media: media
  , country: country
  }
  var q = querystring.stringify(decorate(obj, path, term))
  return [path, q].join('?')
}

function ReqOpts (hostname, port, method, path) {
  this.hostname = hostname
  this.port = port
  this.method = method
  this.path = path
}

// HTTP request options
// - term The search term
FanboyTransform.prototype.reqOpts = function (term) {
  term = term || this.term
  return new ReqOpts(
    this.hostname
  , this.port
  , this.method
  , mkpath(this.path, term, this.media, this.country)
  )
}

function listenerCount (emt, ev) {
  return events.EventEmitter.listenerCount(emt, ev)
}

// Request lookup or search for term.
// - term String() iTunes ID or search term
// - stale Boolean() to signal that data for this term is already stored
FanboyTransform.prototype.request = function (term, stale, cb) {
  var objectMode = this._readableState.objectMode
  if (typeof stale === 'function') {
    cb = stale
    stale = false
  }
  var me = this
  function cached () {
    return me.cache.get(term)
  }
  if (cached()) return cb()
  var opts = this.reqOpts(term)
  function get () {
    if (cached()) return cb()
    me.keysForTerm(term, function (er, keys) {
      me.resultsForKeys(keys, cb)
    })
  }
  var lock = opts.path
  function unlock () {
    me.locker.unlock(lock)
  }
  if (this.locker.lock(lock)) {
    return me.locker.once(lock, get)
  }
  var httpModule = opts.port === 443 ? https : http
  var req = httpModule.request(opts, function (res) {
    if (res.statusCode !== 200) {
      res.once('end', function () {
        unlock()
        cb()
      })
      return res.resume()
    }
    var ok = false
    var parser = JSONStream.parse('results.*')
    var reduce = me.reduce
    var results = []
    var error // just one per request
    function parserData (obj) {
      var result = reduce(obj)
      ok = !!result
      if (ok) {
        results.push(result)
        me.use(JSON.stringify(result))
      }
    }
    function parserError (er) {
      if (listenerCount(parser, 'data')) {
        error = new Error('could not parse data as JSON')
        parser.removeListener('data', parserData)
        parser.end()
      }
    }
    function parserRoot (root, count) {
      if (!count) req.abort()
    }
    function done (er) {
      parser.removeListener('data', parserData)
      parser.removeListener('error', parserError)
      parser.removeListener('root', parserRoot)
      res.removeListener('error', done)
      res.removeListener('end', resEnd)
      res.unpipe()
      unlock()
      cb(er)
    }
    parser.on('data', parserData)
    parser.on('error', parserError)
    parser.once('root', parserRoot)

    var db = me.db
    function resEnd (chunk) {
      if (results.length) {
        put(db, term, results, function (er) {
          done(er || error)
        })
      } else if (!error) {
        del(db, term, function (er) {
          me.cache.set(term, true)
          done(er)
        })
      } else {
        done()
      }
      results = null
    }
    res.once('error', done)
    res.on('end', resEnd)
    res.pipe(parser) // streams1 parser
  })

  function reqError (er) {
    unlock()
    req.removeListener('error', reqError)
    if (stale) return get()
    me.deinit() // write more and we crash
    cb(er)
  }
  req.on('error', reqError)
  req.setSocketKeepAlive(true)
  req.end()
}

FanboyTransform.prototype.toString = function () {
  return 'fanboy: ' + this.constructor.name
}

// Lookup item in store
util.inherits(Lookup, FanboyTransform)
function Lookup (opts) {
  if (!(this instanceof Lookup)) return new Lookup(opts)
  opts = opts || Object.create(null)
  opts.path = '/lookup'
  FanboyTransform.call(this, opts)
}

// The result as JSON string
// - db levelup()
// - id the iTunes ID
// - cb cb(er, value)
function resultForID (db, id, cb) {
  var key = keys.resKey(id)
  db.get(key, function (er, value) {
    cb(er, value)
  })
}

// - chunk iTunes ID (e.g. '537879700')
Lookup.prototype._transform = function (chunk, enc, cb) {
  var me = this
  var db = this.db
  var id = this.decode(chunk)
  resultForID(db, id, function (er, value) {
    if (er) {
      if (er.notFound) {
        return me.request(id, cb)
      }
    } else if (value !== undefined) {
      me.use(value)
    }
    cb(er)
  })
}

util.inherits(Search, FanboyTransform)
function Search (opts) {
  if (!(this instanceof Search)) return new Search(opts)
  FanboyTransform.call(this, opts)
}

function isStale (time, ttl) {
  return Date.now() - time > ttl
}

Search.prototype.keysForTerm = function (term, cb) {
  var ttl = this.ttl
  this.db.get(keys.termKey(term), function (er, value) {
    var keys
    if (!er && !!value) {
      try {
        keys = JSON.parse(value)
        if (isStale(keys.shift(), ttl)) {
          er = new Error('stale keys for ' + term)
          er.notFound = er.stale = true
          keys = null
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
  var me = this
  var stream = lr(new LROpts(this.db))
  function read () {
    var ok = true
    var chunk
    while (ok && null !== (chunk = stream.read())) {
      ok = me.use(chunk)
    }
    if (!ok) me.once('drain', function () {
      read()
    })
  }
  var notFound = []
  function streamError (er) {
    if (!er.notFound) return done(er)
    er.ok = true
    notFound.push(er)
  }
  function write () {
    var ok = true
    while (ok && keys.length) {
      ok = stream.write(keys.shift())
    }
    keys.length ? stream.once('drain', write) : stream.end()
  }
  function done (er) {
    var inconsistent = !!notFound.length
    if (inconsistent) {
      er = new Error('inconsistent database suspected')
    }
    me.removeListener('drain', read)
    stream.removeListener('drain', write)
    stream.removeListener('error', streamError)
    stream.removeListener('finish', done)
    stream.removeListener('readable', streamReadable)
    cb(er)
  }
  function streamReadable () {
    read()
  }
  stream.on('error', streamError)
  stream.on('finish', done)
  stream.on('readable', streamReadable)

  write()
}

Search.prototype._transform = function (chunk, enc, cb) {
  var term = this.decode(chunk)
  var me = this
  this.keysForTerm(term, function (er, keys) {
    if (er) {
      if (er.notFound) {
        me.request(term, er.stale, cb)
      } else {
        cb(er)
      }
    } else {
      me.resultsForKeys(keys, cb)
    }
  })
}

// Suggest search terms
util.inherits(SearchTerms, FanboyTransform)
function SearchTerms (opts) {
  if (!(this instanceof SearchTerms)) return new SearchTerms(opts)
  FanboyTransform.call(this, opts)
}

function keyStream (db, term) {
  return db.createKeyStream(keys.rangeForTerm(term))
}

SearchTerms.prototype._transform = function (chunk, enc, cb) {
  if (this.db.isClosed()) {
    return cb(new Error('database not open'))
  }
  var term = this.decode(chunk)
  var me = this
  var objectMode = this._readableState.objectMode
  var ok = false
  var stream = keyStream(this.db, term)
  function read () {
    var key
    var term
    while (null !== (key = stream.read())) {
      term = keys.termFromKey(key)
      if (!me.use('"' + term + '"')) {
        me.once('drain', read)
        break
      }
    }
  }
  function readable () {
    ok = true
    read()
  }
  function done (er) {
    me.removeListener('drain', read)
    stream.removeListener('end', done)
    stream.removeListener('error', done)
    stream.removeListener('readable', readable)
    cb(er)
  }
  stream.on('end', done)
  stream.on('error', done)
  stream.on('readable', readable)

  read()
}

if (process.env.NODE_TEST) {
  exports.base = FanboyTransform
  exports.debug = debug
  exports.defaults = defaults
  exports.isStale = isStale
  exports.lookup = Lookup
  exports.nop = nop
  exports.putOps = putOps
  exports.reduce = reduce
  exports.resOp = resOp
  exports.search = Search
  exports.suggest = SearchTerms
  exports.termOp = termOp
}
