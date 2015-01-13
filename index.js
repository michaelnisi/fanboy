
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
var stream = require('stream')
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
  this.hostname = opts.hostname || 'itunes.apple.com'
  this.locker = opts.locker || { lock:nop, unlock:nop }
  this.max = opts.max || 500
  this.media = opts.media || 'all'
  this.method = opts.method || 'GET'
  this.path = opts.path || '/search'
  this.port = opts.port || 80
  this.readableObjectMode = opts.readableObjectMode || false
  this.reduce = opts.reduce || reduce
  this.ttl = opts.ttl || 72 * 3600000
}

function defaults (opts) {
  return new Opts(opts)
}

function Fanboy (opts) {
  if (!(this instanceof Fanboy)) return new Fanboy(opts)
  opts = defaults(opts)
  opts.locker = gridlock()
  // We cache terms for which requests have been in vain.
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
  return this.decoder.write(chunk)
}

var TOKENS = ['[', ',', ']\n']
FanboyTransform.prototype.use = function (chunk) {
  if (this._readableState.objectMode) {
    var obj = null
    try {
      obj = JSON.parse(chunk)
    } catch (er) {
      er.warn = true
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

FanboyTransform.prototype._flush = function (cb) {
  if (!this._readableState.objectMode) {
    if (this.state) this.push(TOKENS[2])
    this.state = 0
  }
  this.cache = null
  this.db = null
  this.locker = null
  this.reduce = null
  cb()
}

// Bulk-write operation
function Bulk (type, key, value) {
  this.type = type
  this.key = key
  this.value = value
}

function termKey (term) {
  return keys.key(keys.TRM, term)
}

function termOp (term, keys, now) {
  now = now || Date.now()
  var k = termKey(term)
  var v = JSON.stringify([now].concat(keys))
  return new Bulk('put', k, v)
}

function resOp (result, now) {
  now = now || Date.now()
  result.ts = now
  var k = resKey(result.guid)
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

// Request lookup or search for term. Hold on to your butts!
// - term String() iTunes ID or search term
// - stale Boolean() to signal that data for this term is already stored
FanboyTransform.prototype.request = function (term, stale, cb) {
  if (typeof stale === 'function') {
    cb = stale
    stale = false
  }
  if (this.cache.get(term)) {
    return cb(new Error('cached null'))
  }
  var opts = this.reqOpts(term)
  var me = this
  function get () {
    me.keysForTerm(term, function (er, keys) {
      if (er) return cb(er)
      me.resultsForKeys(keys, cb)
    })
  }
  var lock = opts.path
  function unlock () {
    me.locker.unlock(lock)
  }
  if (this.locker.lock(lock)) {
    me.locker.once(lock, function () {
      get()
    })
    return
  }
  var httpModule = opts.port === 443 ? https : http
  var req = httpModule.request(opts, function (res) {
    var parser = JSONStream.parse('results.*')
    var results = []
    var reduce = me.reduce
    var parserError
    function parserData (obj) {
      var result = reduce(obj)
      if (result) {
        results.push(result)
        me.use(JSON.stringify(result))
      }
    }
    parser.on('data', parserData)
    parser.on('error', function (er) {
      if (listenerCount(parser, 'data')) {
        parser.removeListener('data', parserData)
        parser.end()
        parserError = er
      }
    })
    function done (er) {
      parser.removeAllListeners()
      res.removeAllListeners()
      res.unpipe()
      unlock()
      cb(er)
    }
    parser.once('root', function (root, count) {
      if (!count) {
        me.cache.set(term, true)
        parserError = new Error('JSON contained no results')
        req.abort()
      }
    })

    var db = me.db
    res.once('error', done)
    res.on('end', function (chunk) {
      if (results.length) {
        put(db, term, results, function (er) {
          results = null
          done(er)
        })
      } else {
        done(parserError || new Error('no results'))
      }
    })
    res.pipe(parser)
  })

  function reqError (er) {
    unlock()
    req.removeListener('error', reqError)
    stale ? get() : cb(er)
  }
  req.on('error', reqError)
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

function resKey (id) {
  return keys.key(keys.RES, id)
}

// The result as JSON string
// - db levelup()
// - id the iTunes ID
// - cb cb(er, value)
function resultForID (db, id, cb) {
  var key = resKey(id)
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
      if (!me.use(value)) {
        er = new Error('wait!')
      }
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
  this.db.get(termKey(term), function (er, value) {
    var keys = undefined
    if (value) {
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
  var values = lr(new LROpts(this.db))
  function done (er) {
    values.removeAllListeners()
    cb(er)
  }
  values.on('error', done)
  values.on('finish', done)
  var used = true
  function useValues () {
    var chunk
    while (used && null !== (chunk = values.read())) {
      used = me.use(chunk)
    }
    if (!used) me.once('drain', function () {
      used = true
      useValues()
    })
  }
  values.on('readable', useValues)
  function writeKeys () {
    var ok = true
    do {
      ok = values.write(keys.shift())
    } while (ok && keys.length)
    keys.length ? values.once('drain', writeKeys) : values.end()
  }
  writeKeys()
}

Search.prototype._transform = function (chunk, enc, cb) {
  var term = this.decode(chunk)
  var me = this
  this.keysForTerm(term, function (er, keys) {
    if (er) {
      return er.notFound ? me.request(term, er.stale, cb) : cb(er)
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
  return db.createKeyStream(keys.range(keys.TRM, term))
}

SearchTerms.prototype._transform = function (chunk, enc, cb) {
  var term = this.decode(chunk).toLowerCase()
  var me = this
  var stream = keyStream(this.db, term)
  var read = false
  stream.on('readable', function () {
    read = true
    var key
    var term
    (function go () {
      while (null !== (key = stream.read())) {
        term = key.split(keys.DIV)[2]
        if (!me.use('"' + term + '"')) {
          me.once('drain', go)
          break
        }
      }
    })()
  })
  function done (er) {
    if (!er && !read) { // don't shadow stream error
      me.emit('error', new Error('no results'))
    }
    cb(er)
    stream.removeAllListeners()
  }
  stream.on('error', done)
  stream.once('end', done)
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
