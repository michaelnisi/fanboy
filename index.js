
// fanboy - search itunes store

module.exports.Search = Search
module.exports.SearchOpts = SearchOpts

var stream = require('stream')
  , util = require('util')
  , https = require('https')
  , querystring = require('querystring')
  , string_decoder = require('string_decoder')

util.inherits(Search, stream.Transform)
function Search (opts) {
  if (!(this instanceof Search)) return new Search(opts)
  stream.Transform.call(this)
  this.opts = opts || new SearchOpts()
}

Search.prototype.reqOpts = function (term) {
  return this.opts.reqOpts(term)
}

Search.prototype._transform = function (chunk, enc, cb) {
  // TODO: Emit term suggestions
  var term = decode(chunk)
    , opts = this.reqOpts(term)
    , me = this

  var req = https.request(opts, function (res) {
    res.on('readable', function () {
      var chunk
      while (null !== (chunk = res.read())) {
        me.push(chunk)
      }
    })
    res.on('error', function (er) {
      cb(er)
    })
    res.on('end', function (chunk) {
      me.push(chunk)
      cb()
    })
  })
  req.end()
}

// Search options object
function SearchOpts (
  hostname
, port
, method
, path
, term
, media
, country
) {
  this.hostname = hostname || 'itunes.apple.com'
  this.port = port         || 443
  this.method = method     || 'GET'
  this.path = path         || '/search'
  this.term = term         || '*'
  this.media = media       || 'all'
  this.country = country   || 'us'
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

