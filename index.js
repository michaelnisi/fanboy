
// fanboy - search itunes store

exports.lookup = Lookup
exports.search = Search
exports.suggest = SearchTerms

var assert = require('assert')
  , events = require('events')
  , https = require('https')
  , http = require('http')
  , JSONStream = require('JSONStream')
  , keys = require('./lib/keys')
  , querystring = require('querystring')
  , lr = require('level-random')
  , reduce = require('./lib/reduce')
  , stream = require('stream')
  , string_decoder = require('string_decoder')
  , util = require('util')
  ;

function noop () {}

var debug = function () {
  return process.env.NODE_DEBUG ?
    function (o) {
      console.error('**fanboy: %s', util.inspect(o))
    } : noop
}()

function defaults (opts) {
  opts = opts || Object.create(null)
  opts.country = opts.country || 'us'
  opts.db = opts.db
  opts.hostname = opts.hostname || 'itunes.apple.com'
  opts.media = opts.media || 'all'
  opts.method = opts.method || 'GET'
  opts.path = opts.path || '/search'
  opts.port = opts.port || 443
  opts.readableObjectMode = opts.readableObjectMode || false
  opts.reduce = opts.reduce || reduce
  opts.term = opts.term || '*'
  opts.ttl = opts.ttl || 72 * 3600000
  return opts
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

FanboyTransform.prototype._flush = function () {
  if (!this._readableState.objectMode) {
    if (this.state) this.push(TOKENS[2])
    this.state = 0
  }
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
  var key = termKey(term)
    , val = JSON.stringify([now].concat(keys))
    ;
  return new Bulk('put', key, val)
}

function resOp (result, now) {
  now = now || Date.now()
  result.ts = now
  var key = resKey(result.guid)
    , val = JSON.stringify(result)
    ;
  return new Bulk('put', key, val)
}

function putOps (term, results, now) {
  var op
    , ops = []
    , keys = []
    ;
  results.forEach(function (result) {
    op = resOp(result, now)
    ops.push(op)
    keys.push(op.key)
  })
  ops.push(termOp(term, keys, now))
  return ops
}

function put (db, term, results, cb) {
  if (results && results.length) {
    db.batch(putOps(term, results), function (er) {
      cb(er)
    })
  } else {
    cb()
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

// HTTPS request options
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

// Request lookup or search for term
// - term iTunes ID or search term
FanboyTransform.prototype.request = function (term, cb) {
  var opts = this.reqOpts(term)
    , me = this
    , httpModule = opts.port === 443 ? https : http
    ;
  var req = httpModule.request(opts, function (res) {
    var parser = JSONStream.parse('results.*')
      , results = []
      , reduce = me.reduce
      , parserError
      ;
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
      cb(er)
    }
    parser.once('root', function (root, count) {
      if (!count) {
        parserError = new Error('JSON contained no results')
        req.abort()
      }
    })

    var db = me.db
    res.once('end', function (chunk) {
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

  req.on('error', function (er) {
    cb(er)
  })
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
    , db = this.db
    , id = this.decode(chunk)
    ;
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

function stale (time, ttl) {
  return Date.now() - time > ttl
}

Search.prototype.keysForTerm = function (term, cb) {
  var ttl = this.ttl
  this.db.get(termKey(term), function (er, value) {
    var keys
    if (value) {
      try {
        keys = JSON.parse(value)
        if (stale(keys.shift(), ttl)) {
          er = new Error('stale keys for ' + term)
          er.notFound = true
          keys = null
        }
      } catch (ex) {
        er = ex
      }
    }
    cb(er, keys)
  })
}

Search.prototype.resultsForKeys = function (keys, cb) {
  var me = this
    , values = lr({ db:this.db })
    ;
  values.on('error', cb)
  values.on('finish', cb)
  function useValues () {
    var chunk
    while (null !== (chunk = values.read())) {
      if (!me.use(chunk)) return me.once('drain', useValues)
    }
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
    , me = this
    ;
  this.keysForTerm(term, function (er, keys) {
    if (er) {
      return er.notFound ? me.request(term, cb) : cb(er)
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
    , me = this
    , stream = keyStream(this.db, term)
    ;
  stream.on('readable', function () {
    var key
      , term
      ;
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
  stream.on('error', function (er) {
    cb(er)
  })
  stream.once('end', function () {
    stream.removeAllListeners()
    cb()
  })
}

if (process.env.NODE_TEST) {
  exports.base = FanboyTransform
  exports.defaults = defaults
  exports.debug = debug
  exports.noop = noop
  exports.putOps = putOps
  exports.reduce = reduce
  exports.resOp = resOp
  exports.termOp = termOp
}
