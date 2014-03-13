
// fanboy - search itunes store

module.exports.search = Search
module.exports.opts = SearchOpts
module.exports.terms = SearchTerms
module.exports.lookup = Lookup

if (process.env.NODE_TEST) {
  module.exports.parse = parse
  module.exports.stringify = stringify
}

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

util.inherits(ASearch, stream.Transform)
function ASearch (db, log) {
  if (!(this instanceof ASearch)) return new ASearch(db, log)
  stream.Transform.call(this)
  this.db = db
  this.log = log
}

ASearch.prototype.toString = function () {
  return ['fanboy ', this.constructor.name].join()
}

ASearch.prototype.error = function (x) {
  if (this.log) this.log.error(x)
  debug(x)
}

ASearch.prototype.info = function (x) {
  if (this.log) this.log.info(x)
  debug(x)
}

// Lookup item in store
util.inherits(Lookup, ASearch)
function Lookup (db, log) {
  if (!(this instanceof Lookup)) return new Lookup(db, log)
  ASearch.call(this, db, log)
}

function localLookup (db, id, cb) {
  cb(null, 'local')
}

function lookup (id, cb) {
  cb(null, 'web')
}

// - chunk iTunes ID (e.g., 537879700)
Lookup.prototype._transform = function (chunk, enc, cb) {
  var me = this
    , db = this.db
    , id = decode(chunk)
  localLookup(db, id, function (er, value) {
    if (value) {
      me.push(value)
      cb(er)
    } else {
      me.lookup(term, cb)
    }
  })
}

// Suggest search terms
util.inherits(SearchTerms, ASearch)
function SearchTerms (db, log) {
  if (!(this instanceof SearchTerms)) return new SearchTerms(db, log)
  ASearch.call(this, db, log)
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
    stream.removeAllListeners()
    cb()
  })
}

util.inherits(Search, ASearch)
function Search (db, log, opts) {
  if (!(this instanceof Search)) return new Search(db, log, opts)
  ASearch.call(this, db, log)
  this.opts = opts || SearchOpts()
}

Search.prototype.requestResult = function (term, cb) {
  var opts = this.opts
    , reduce = opts.reduce
    , db = this.db
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

Search.prototype._transform = function (chunk, enc, cb) {
  var term = decode(chunk)
    , me = this

  getResult(this.db, term, function (er, value) {
    if (value) {
      me.push(value)
      cb()
    } else {
      me.requestResult(term, cb)
    }
  })
}

function now () {
  return new Date().getTime()
}

function stringify (results, time) {
  if (!results) throw(new Error('Pointless to store undefined or null'))
  return [time || now(), JSON.stringify(results)].join('')
}

function putTerm(db, term, results, cb) {
  var key = keys.key(keys.TRM, term)
  db.put(key, stringify(results), function (er) {
    cb(er, key)
  })
}

// [now(), json]
function parse (str) {
  var i = str.indexOf('[')
  return [parseInt(str.slice(0, i)), str.slice(i)]
}

function results (value, ttl) {
  if (!value) return null
  var tuple = parse(value)
  return now() - tuple[0] > ttl ? null : tuple[1]
}

function getResult(db, term, cb) {
  var key = keys.key(keys.TRM, term)
  db.get(key, function (er, value) {
    cb(er, results(value))
  })
}

// Search options object
function SearchOpts (
  country
, hostname
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
    , hostname
    , media
    , method
    , path
    , port
    , reduce
    , term
    , ttl
  )}
  this.country = country || 'us'
  this.hostname = hostname || 'itunes.apple.com'
  this.media = media || 'all'
  this.method = method || 'GET'
  this.path = path || '/search'
  this.port = port || 443
  this.reduce = reduce
  this.term = term || '*'
  this.ttl = ttl || 72 * 3600000
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
