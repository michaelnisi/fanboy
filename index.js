
// fanboy - use Apple search API

module.exports.Search = Search
module.exports.SearchOpts = SearchOpts

var stream = require('stream')
  , util = require('util')
  , https = require('https')
  , querystring = require('querystring')

util.inherits(Search, stream.Transform)
function Search (opts) {
  if (!(this instanceof Search)) return new Search(opts)
  stream.Readable.call(this)
  this.opts = opts
}


var _httpsOpts
Search.prototype.httpsOpts = function (term) {
  if (!_httpsOpts) {
    var opts = this.opts
    _httpOpts = {
      hostname: opts.hostname
    , path: '/?search' // TODO: write
    }
  }
  return _httpsOpts;
}

Search.prototype._transform = function (chunk, enc, cb) {
  var req = http.request(this.httpOpts(uri), function (res) {

  })
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

SearchOpts.prototype.reqOpts = function (term) {
  return {
    hostname: this.hostname
  , port: this.port
  , method: this.method
  , path: mkpath(this.path, term || this.term, this.media, this.country)
  }
}
