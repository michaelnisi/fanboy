
// fanboy - search itunes store

module.exports.search = Search
module.exports.opts = SearchOpts
module.exports.terms = SearchTerms

var https = require('https')
  , JSONStream = require('JSONStream')
  , keys = require('./lib/keys')
  , querystring = require('querystring')
  , stream = require('stream')
  , string_decoder = require('string_decoder')
  , util = require('util')

var debug
if (process.env.NODE_DEBUG || process.env.NODE_TEST) {
  debug = function (o) { console.error('**fanboy: %s', o) }
} else {
  debug = function () { }
}

// Stream of stored search terms
// - db levelup()
util.inherits(SearchTerms, stream.Transform)
function SearchTerms (db) {
  if (!(this instanceof SearchTerms)) return new SearchTerms(db)
  stream.Transform.call(this)
  this.db = db
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
      me.push(key)
    }
  })
  stream.on('error', function (er) {
    cb(er)
  })
  stream.once('end', function () {
    cb()
  })
}

util.inherits(Search, stream.Transform)
function Search (opts) {
  if (!(this instanceof Search)) return new Search(opts)
  stream.Transform.call(this)
  this.opts = opts || SearchOpts()
  this.log = this.opts.log
}

Search.prototype.requestResult = function (term, cb) {
  var opts = this.opts
    , reduce = opts.reduce
    , db = opts.db
    , me = this
    , results = []

  var req = https.request(opts.reqOpts(term), function (res) {
    var str = JSONStream.stringify()
    str.on('data', function (chunk) {
      me.push(chunk)
    })
    var parser = JSONStream.parse('results.*')
    parser.on('data', function (obj) {
      var result = reduce ? reduce(obj) : obj
      results.push(result)
      str.write(result)
    })
    res.on('error', cb)
    res.once('end', function (chunk) {
      putTerm(db, term, results, function (er, key) {
        results = null
        str.end()
        ;[res, str, parser].forEach(function (stream) {
          stream.removeAllListeners()
        })
        cb()
      })
    })
    res.pipe(parser)
  })
  req.end()
}

function stale (value, ttl) {
  return new Date().getTime() - value.time > ttl
}

Search.prototype._transform = function (chunk, enc, cb) {
  var term = decode(chunk)
    , me = this
    , opts = this.opts

  getResult(opts.db, term, function (er, value) {
    if (value && !stale(value, opts.ttl)) {
      me.push(value)
      cb()
    } else {
      me.requestResult(term, cb)
    }
  })
}

Search.prototype.toString = function () {
  return ['fanboy ', this.constructor.name].join()
}

Search.prototype.error = function (x) {
  if (this.log) this.log.error(x)
  debug(x)
}

Search.prototype.info = function (x) {
  if (this.log) this.log.info(x)
  debug(x)
}

function ResultValue (time, json) {
  this.time = time
  this.json = json
}

function value (json) {
  var time = new Date().getTime()
    , obj = new ResultValue(time, json)
  return JSON.stringify(obj)
}

function putTerm(db, term, results, cb) {
  var key = keys.key(keys.TRM, term)
  db.put(key, value(results), function (er) {
    cb(er, key)
  })
}

function getResult(db, term, cb) {
  var key = keys.key(keys.TRM, term)
  db.get(key, function (er, value) {
    cb(er, value ? value.json : null)
  })
}

// Search options object
function SearchOpts (
  country
, db
, hostname
, log
, media
, method
, path
, port
, reduce
, term
, ttl
) {
  if (!(this instanceof SearchOpts)) {
    return new SearchOpts(
      country
    , db
    , hostname
    , log
    , media
    , method
    , path
    , port
    , reduce
    , term
    , ttl
  )}
  this.country = country || 'us'
  this.db = db
  this.hostname = hostname || 'itunes.apple.com'
  this.log = log
  this.media = media || 'all'
  this.method = method || 'GET'
  this.path = path || '/search'
  this.port = port || 443
  this.reduce = reduce
  this.term = term || '*'
  this.ttl = ttl || 3 * 3600000
}

function mkpath (path, term, media, country) {
  var q = querystring.stringify({
    term: term
  , media: media
  , country: country
  })
  return [path, q].join('?')
}

// HTTP request options
// - term The search term
SearchOpts.prototype.reqOpts = function (term) {
  return {
    hostname: this.hostname
  , port: this.port
  , method: this.method
  , path: mkpath(this.path, term || this.term, this.media, this.country)
  }
}

// Decode utf8 binary to string
// - buf utf8 encoded binary
var decoder = new string_decoder.StringDecoder()
function decode (buf) {
  return decoder.write(buf)
}
