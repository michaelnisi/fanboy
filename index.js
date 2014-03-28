
// fanboy - search itunes store

module.exports.lookup = Lookup
module.exports.search = Search
module.exports.terms = SearchTerms

if (process.env.NODE_TEST) {
  module.exports.base = Fanboy
  module.exports.putOps = putOps
}

var assert = require('assert')
  , https = require('https')
  , JSONStream = require('JSONStream')
  , keys = require('./lib/keys')
  , querystring = require('querystring')
  , stream = require('stream')
  , string_decoder = require('string_decoder')
  , util = require('util')

var debug
if (process.env.NODE_DEBUG || process.env.NODE_TEST) {
  debug = function (o) { console.error('**fanboy: %s', util.inspect(o)) }
} else {
  debug = function () { }
}

// Default for user provided fun
function reduce (obj) {
  return obj
}

function defaults (opts) {
  opts = opts || Object.create(null)
  opts.country = opts.country || 'us'
  opts.db = opts.db
  opts.hostname = opts.hostname || 'itunes.apple.com'
  opts.log = opts.log
  opts.media = opts.media || 'all'
  opts.method = opts.method || 'GET'
  opts.path = opts.path || '/search'
  opts.port = opts.port || 443
  opts.reduce = opts.reduce || reduce
  opts.term = opts.term || '*'
  opts.ttl = opts.ttl || 72 * 3600000
  return opts
}

util.inherits(Fanboy, stream.Transform)
function Fanboy (opts) {
  if (!(this instanceof Fanboy)) return new Fanboy(opts)
  stream.Transform.call(this)
  util._extend(this, defaults(opts))
  this.state = 0
}

var tokens = ['[', ',']
Fanboy.prototype.pushJSON = function (chunk) {
  this.push(tokens[this.state] + chunk)
  this.state = 1
}

Fanboy.prototype._flush = function () {
  this.state = 0
  this.push(']')
}

function release (emitters) {
  emitters.forEach(function (emitter) {
    emitter.removeAllListeners()
  })
}

// Bulk-write operation
function BWOp (type, key, value) {
  this.type = type
  this.key = key
  this.value = value
}

function resOp (result) {
  var key = resKey(result.guid)
    , val = JSON.stringify(result)
  return new BWOp('put', key, val)
}

function termKey (term) {
  return keys.key(keys.TRM, term)
}

function termOp (term, keys) {
  return new BWOp('put', termKey(term), keys)
}

function putOps (term, results) {
  var op
    , ops = []
    , keys = []
  results.forEach(function (result) {
    op = resOp(result)
    ops.push(op)
    keys.push(op.key)
  })
  ops.push(termOp(term, keys))
  return ops
}

function put (db, term, results, cb) {
  db.batch(putOps(term, results), function (er) {
    cb(er)
  })
}

function decorate (obj, path, term) {
  if (path === '/search') {
    obj.term = term
  } else if (path === '/lookup') {
    obj.id = term
  }
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
Fanboy.prototype.reqOpts = function (term) {
  return new ReqOpts(
    this.hostname
  , this.port
  , this.method
  , mkpath(this.path, term || this.term, this.media, this.country)
  )
}

// Request lookup or search for term
// - term iTunes ID or search term
Fanboy.prototype.request = function (term, cb) {
  var opts = this.reqOpts(term)
    , me = this
    , reduce = this.reduce
    , db = this.db
    , results = [] // Collect for batch-write

  https.request(opts, function (res) {
    var parser = JSONStream.parse('results.*')
    parser.on('data', function (obj) {
      var result = reduce(obj)
      results.push(result)
      me.pushJSON(JSON.stringify(result))
    })
    res.on('error', cb)
    res.once('end', function (chunk) {
      put(db, term, results, function (er) {
        if (er) me.error(er)
        results = null
      })
      release([res, parser])
      cb()
    })
    res.pipe(parser)
  }).end()
}

Fanboy.prototype.toString = function () {
  return ['fanboy', this.constructor.name].join(': ')
}

Fanboy.prototype.error = function (x) {
  if (this.log) this.log.error(x)
  debug(x)
}

Fanboy.prototype.info = function (x) {
  if (this.log) this.log.info(x)
  debug(x)
}

// Lookup item in store
util.inherits(Lookup, Fanboy)
function Lookup (opts) {
  if (!(this instanceof Lookup)) return new Lookup(opts)
  opts = opts || Object.create(null)
  opts.path = '/lookup'
  Fanboy.call(this, opts)
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

// Decode utf8 binary to string
// - buf utf8 encoded binary
var decoder = new string_decoder.StringDecoder()
function decode (buf) {
  return decoder.write(buf)
}

// - chunk iTunes ID (e.g., 537879700)
Lookup.prototype._transform = function (chunk, enc, cb) {
  var me = this
    , db = this.db
    , id = decode(chunk)
  resultForID(db, id, function (er, value) {
    if (er && !er.notFound) me.error(er)
    if (value) {
      me.pushJSON(value)
      cb(er)
    } else {
      me.request(id, cb)
    }
  })
}

util.inherits(Search, Fanboy)
function Search (opts) {
  if (!(this instanceof Search)) return new Search(opts)
  Fanboy.call(this, opts)
}

function keysForTerm (db, term, cb) {
  db.get(termKey(term), function (er, value) {
    var keys
    if (value) {
      try {
        keys = JSON.parse(value)
      } catch (er) {}
    }
    cb(er, keys)
  })
}

Search.prototype.resultsForKeys = function (keys, cb) {
  cb()
}

Search.prototype._transform = function (chunk, enc, cb) {
  var term = decode(chunk)
    , me = this
    , db = this.db

  keysForTerm(db, term, function (er, keys) {
    if (er) me.error(er)
    if (keys) {
      me.resultsForKeys(keys, cb)
    } else {
      me.request(term, cb)
    }
  })
}

// Suggest search terms
util.inherits(SearchTerms, Fanboy)
function SearchTerms (opts) {
  if (!(this instanceof SearchTerms)) return new SearchTerms(opts)
  Fanboy.call(this, opts)
}

function keyStream (db, term) {
  return db.createKeyStream(keys.range(keys.TRM, term))
}

SearchTerms.prototype._transform = function (chunk, enc, cb) {
  var stream = keyStream(this.db, chunk)
    , me = this

  stream.on('readable', function () {
    var key
    while (null !== (key = stream.read())) {
      me.pushJSON(key)
    }
  })
  stream.on('error', function (er) {
    cb(er)
  })
  stream.once('end', function () {
    stream.removeAllListeners()
    cb()
  })
}
