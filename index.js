
// fanboy - search itunes store

module.exports.Search = Search
module.exports.SearchOpts = SearchOpts

var https = require('https')
  , JSONStream = require('JSONStream')
  , querystring = require('querystring')
  , string_decoder = require('string_decoder')
  , stream = require('stream')
  , util = require('util')
  , keys = require('./lib/keys')

util.inherits(Search, stream.Transform)
function Search (opts) {
  if (!(this instanceof Search)) return new Search(opts)
  stream.Transform.call(this)
  this.opts = opts || new SearchOpts()
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

Search.prototype.requestResult = function (term, cb) {
  var opts = this.opts.reqOpts(term)
    , reduce = this.opts.reduce
    , db = this.opts.db
    , me = this
    , results = []

  var req = https.request(opts, function (res) {
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

Search.prototype._transform = function (chunk, enc, cb) {
  // TODO: Emit term suggestions
  var term = decode(chunk)
    , me = this
    , db = this.opts.db

  getResult(db, term, function (er, value) {
    if (value) {
      me.push(value)
      cb()
    } else {
      me.requestResult(term, cb)
    }
  })

}

// Search options object
function SearchOpts (
  media
, hostname
, port
, method
, path
, term
, country
, reduce
, db
, log
) {
  if (!(this instanceof SearchOpts)) {
    return new SearchOpts(
      media
    , hostname
    , port
    , method
    , path
    , term
    , country
    , reduce
    , db
    , log
  )}
  this.media = media       || 'all'
  this.hostname = hostname || 'itunes.apple.com'
  this.port = port         || 443
  this.method = method     || 'GET'
  this.path = path         || '/search'
  this.term = term         || '*'
  this.country = country   || 'us'
  this.reduce = reduce
  this.db = db
  this.log = log
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
