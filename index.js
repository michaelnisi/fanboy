// fanboy - search itunes store

exports = module.exports = Fanboy

var JSONStream = require('JSONStream')
var events = require('events')
var gridlock = require('gridlock')
var http = require('http')
var https = require('https')
var keys = require('./lib/keys')
var levelup = require('levelup')
var lr = require('level-random')
var lru = require('lru-cache')
var querystring = require('querystring')
var reduce = require('./lib/reduce')
var stream = require('readable-stream')
var string_decoder = require('string_decoder')
var util = require('util')

function nop () {}

var debugging = parseInt(process.env.NODE_DEBUG, 10) === 1
var debug = (function () {
  return debugging ? function (o) {
    console.error('** fanboy: %s', util.inspect(o))
  } : nop
})()

var testing = parseInt(process.env.NODE_TEST, 10) === 1

function Opts (opts) {
  opts = opts || Object.create(null)
  this.cache = opts.cache || { set: nop, get: nop, reset: nop }
  this.cacheSize = opts.cacheSize
  this.country = opts.country || 'us'
  this.highWaterMark = opts.highWaterMark
  this.hostname = opts.hostname || 'itunes.apple.com'
  this.locker = opts.locker || { lock: nop, unlock: nop }
  this.max = opts.max || 500
  this.media = opts.media || 'all'
  this.method = opts.method || 'GET'
  this.objectMode = !!opts.objectMode
  this.path = opts.path || '/search'
  this.port = opts.port || 80
  this.reduce = opts.reduce || reduce
  this.ttl = opts.ttl || 24 * 3600 * 1000
}

function defaults (opts) {
  return new Opts(opts)
}

function sharedState (opts) {
  opts.locker = gridlock()
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
  opts = sharedState(opts)
  this.opts = opts
}
util.inherits(Fanboy, events.EventEmitter)

Fanboy.prototype.search = function () {
  return new Search(this.db, this.opts)
}

Fanboy.prototype.lookup = function () {
  return new Lookup(this.db, this.opts)
}

Fanboy.prototype.suggest = function () {
  return new SearchTerms(this.db, this.opts)
}

if (testing) {
  Fanboy.prototype.close = function (cb) {
    this.db.close(cb)
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
  opts = defaults(opts)

  var sopts = new TransformOpts(opts.highWaterMark)
  stream.Transform.call(this, sopts)

  util._extend(this, opts)
  this.decoder = new string_decoder.StringDecoder()
  this.state = 0
  this._readableState.objectMode = opts.objectMode
}
util.inherits(FanboyTransform, stream.Transform)

FanboyTransform.prototype.decode = function (chunk) {
  return this.decoder.write(chunk).toLowerCase()
}

var TOKENS = ['[', ',', ']\n']
FanboyTransform.prototype.use = function (chunk) {
  if (this._readableState.objectMode) {
    var obj = null
    try {
      obj = JSON.parse(chunk)
    } catch (error) {
      var er = new Error('fanboy: cannot use: ' + error.message)
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
  now = now || Date.now()
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
    cb(new Error('fanboy: cannot store empty results'))
  }
}

function del (db, term, cb) {
  db.del(keys.termKey(term), cb)
}

var verbs = { '/search': 'term', '/lookup': 'id' }
function decorate (obj, path, term) {
  obj[verbs[path]] = term
  return obj
}

function mkpath (path, term, media, country) {
  var obj = {
    media: media,
    country: country
  }
  var q = querystring.stringify(decorate(obj, path, term))
  return [path, q].join('?')
}

function ReqOpts (hostname, keepAlive, port, method, path) {
  this.hostname = hostname
  this.keepAlive = keepAlive
  this.method = method
  this.path = path
  this.port = port
}

// HTTP request options
// - term The search term
FanboyTransform.prototype.reqOpts = function (term) {
  term = term || this.term
  var p = mkpath(this.path, term, this.media, this.country)
  return new ReqOpts(this.hostname, true, this.port, this.method, p)
}

// JSONStream is objectionable.
function parse (readable) {
  var parser = JSONStream.parse('results.*')
  function onerror () {
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
// - term String() iTunes ID or search term
// - keys [String] Array of cached keys (optional)
FanboyTransform.prototype.request = function (term, keys, cb) {
  if (typeof keys === 'function') {
    cb = keys
    keys = null
  }
  var me = this
  function cached () {
    return me.cache.get(term)
  }
  if (cached()) return cb()
  var opts = this.reqOpts(term)
  function get () {
    if (cached()) return cb()
    if (keys) {
      return me.resultsForKeys(keys, cb)
    }
    me.keysForTerm(term, function (er, keys) {
      if (er) {
        return cb(er.notFound ? null : er)
      }
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
  // Make the request already!
  var mod = opts.port === 443 ? https : http
  var req = mod.request(opts, function (res) {
    var statusCode = res.statusCode
    if (statusCode !== 200) {
      res.once('end', function () {
        unlock()
        var er = new Error('fanboy: unexpected response ' + statusCode)
        er.statusCode = statusCode
        er.headers = res.headers
        util._extend(er, opts)
        me.emit('error', er)
        cb()
      })
      return res.resume()
    }
    var parser = parse(res)
    function ondrain () {
      parser.resume()
    }
    var results = []
    function ondata (obj) {
      var result = reduce(obj)
      if (result) {
        results.push(result)
        var chunk = JSON.stringify(result)
        if (!me.use(chunk)) {
          parser.pause()
          me.on('drain', ondrain)
        }
      }
    }
    var ok = true
    function onend () {
      if (results.length) {
        put(me.db, term, results, function (er) {
          done(er)
        })
      } else if (ok) {
        var cache = me.cache
        del(me.db, term, function (er) {
          cache.set(term, true)
          done(er)
        })
      } else {
        done()
      }
    }
    function onerror (error) {
      ok = false
      var er = new Error('fanboy: parse error: ' + error.message)
      done(er)
    }
    function done (er) {
      if (!cb) return
      me.removeListener('drain', ondrain)
      parser.removeListener('data', ondata)
      parser.removeListener('end', onend)
      parser.removeListener('error', onerror)
      cb(er)
      cb = null
      me = null
    }
    parser.on('data', ondata)
    parser.on('end', onend)
    parser.on('error', onerror)
  })
  function onerror (error) {
    unlock()
    req.removeListener('error', onerror)
    var er = util._extend(new Error(), error)
    er.message = 'fanboy: ' + error.message
    if (keys) {
      er.message = 'fanboy: fell back on cache ' + er.code
      me.emit('error', er)
      return get()
    }
    cb(er)
  }
  req.on('error', onerror)
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
  var key = keys.resKey(id)
  db.get(key, function (er, value) {
    cb(er, value)
  })
}

// - chunk iTunes ID (e.g. '537879700')
Lookup.prototype._transform = function (chunk, enc, cb) {
  var me = this
  var db = this.db
  var guid = this.decode(chunk)
  if (!parseInt(guid, 10)) {
    return cb(new Error('fanboy: guid ' + guid + ' is not a number'))
  }
  resultForID(db, guid, function (er, value) {
    if (er) {
      if (er.notFound) {
        return me.request(guid, cb)
      }
    } else if (value !== undefined) {
      me.use(value)
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
  var ttl = this.ttl
  this.db.get(keys.termKey(term), function (er, value) {
    var keys
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
  var me = this
  var s = lr(new LROpts(this.db))
  function read () {
    if (me._writableState.needDrain) return
    var ok = true
    var chunk
    while (ok && (chunk = s.read()) !== null) {
      ok = me.use(chunk)
    }
    if (!ok) {
      me.once('drain', read)
    } else {
      me.removeListener('drain', read)
    }
  }
  var notFound = []
  function onerror (error) {
    if (error.notFound) {
      notFound.push(error)
    } else {
      var er = new Error('fanboy: ' + error.message)
      done(er)
    }
  }
  function write () {
    var ok = false
    var chunk
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
    var er
    var inconsistent = notFound.length > 0
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
    cb = null
  }
  write()
}

Search.prototype._transform = function (chunk, enc, cb) {
  var term = this.decode(chunk)
  var me = this
  this.keysForTerm(term, function (er, keys) {
    if (er) {
      if (er.notFound) {
        me.request(term, keys, cb)
      } else {
        cb(er)
      }
    } else {
      me.resultsForKeys(keys, cb)
    }
  })
}

// Suggest search terms
function SearchTerms (db, opts) {
  if (!(this instanceof SearchTerms)) return new SearchTerms(db, opts)
  FanboyTransform.call(this, db, opts)
}
util.inherits(SearchTerms, FanboyTransform)

function keyStream (db, term) {
  return db.createKeyStream(keys.rangeForTerm(term))
}

SearchTerms.prototype._transform = function (chunk, enc, cb) {
  var term = this.decode(chunk)
  var me = this
  var reader = keyStream(this.db, term)
  function read () {
    var chunk
    var ok
    var sug
    do {
      chunk = reader.read()
      if (chunk) {
        sug = keys.termFromKey(chunk)
        ok = me.use('"' + sug + '"')
      }
    } while (chunk && ok)
    if (ok === false) {
      me.once('drain', read)
    }
  }
  function onerror (error) {
    var er = new Error('fanboy: failed to stream keys: ' + error.message)
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
    cb = null
    me = null
  }
  reader.on('end', done)
  reader.on('error', onerror)
  reader.on('readable', read)
}

if (testing) {
  exports.base = FanboyTransform
  exports.debug = debug
  exports.defaults = defaults
  exports.isStale = isStale
  exports.lookup = Lookup
  exports.nop = nop
  exports.parse = parse
  exports.putOps = putOps
  exports.reduce = reduce
  exports.resOp = resOp
  exports.search = Search
  exports.suggest = SearchTerms
  exports.termOp = termOp
}
