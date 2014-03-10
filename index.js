
// fanboy - search itunes store

module.exports.Search = Search
module.exports.SearchOpts = SearchOpts

var https = require('https')
  , JSONStream = require('JSONStream')
  , querystring = require('querystring')
  , string_decoder = require('string_decoder')
  , stream = require('stream')
  , util = require('util')

util.inherits(Search, stream.Transform)
function Search (opts) {
  if (!(this instanceof Search)) return new Search(opts)
  stream.Transform.call(this)
  this.opts = opts || new SearchOpts()
  this.log = opts.log
  this.db = opts.db
}

Search.prototype._transform = function (chunk, enc, cb) {
  // TODO: Emit term suggestions
  var term = decode(chunk)
    , opts = this.opts.reqOpts(term)
    , reduce = this.opts.reduce
    , me = this

  var req = https.request(opts, function (res) {
    var str = JSONStream.stringify()
    str.on('data', function (chunk) {
      me.push(chunk)
    })
    var parser = JSONStream.parse('results.*')
    parser.on('data', function (result) {
      str.write(reduce(result))
    })
    res.on('error', cb)
    res.once('end', function (chunk) {
      str.end()
      ;[res, str, parser].forEach(function (stream) {
        stream.removeAllListeners()
      })
      cb()
    })
    res.pipe(parser)
  })
  req.end()
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
  )}
  this.media = media       || 'all'
  this.hostname = hostname || 'itunes.apple.com'
  this.port = port         || 443
  this.method = method     || 'GET'
  this.path = path         || '/search'
  this.term = term         || '*'
  this.country = country   || 'us'
  this.reduce = reduce || function (result) {
    return new Result(
      result.artistName
    , result.collectionName
    )
  }
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

// Reduced search result object
function Result (author, title) {
  this.author = author
  this.title = title
}
