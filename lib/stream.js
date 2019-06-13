'use strict'

// stream.js - Base Transform

const { StringDecoder } = require('string_decoder')
const stream = require('readable-stream')
const querystring = require('querystring')
const { inherits } = require('util')
const { request } = require('./http')

exports.defaults = defaults
exports.guid = guid
exports.mkpath = mkpath
exports.nop = nop
exports.FanboyTransform = FanboyTransform

function nop () {}

function guid (obj) {
  obj.guid = obj.collectionId
  return obj
}

function Opts (
  cache = { set: nop, get: nop, reset: nop },
  cacheSize = 8 * 1024 * 1024,
  country = 'us',
  highWaterMark,
  hostname = 'itunes.apple.com',
  max = 500,
  media = 'all',
  objectMode = false,
  path = '/search',
  port = 80,
  result = guid,
  ttl = 24 * 36e5
) {
  this.cache = cache
  this.cacheSize = cacheSize
  this.country = country
  this.result = result
  this.highWaterMark = highWaterMark
  this.hostname = hostname
  this.max = max
  this.media = media
  this.objectMode = objectMode
  this.path = path
  this.port = port
  this.ttl = ttl
}

function defaults (opts = Object.create(null)) {
  return new Opts(
    opts.cache,
    opts.cacheSize,
    opts.country,
    opts.highWaterMark,
    opts.hostname,
    opts.max,
    opts.media,
    opts.objectMode,
    opts.path,
    opts.port,
    opts.result,
    opts.ttl
  )
}

function TransformOpts (highWaterMark) {
  this.highWaterMark = highWaterMark
}

function FanboyTransform (db, opts) {
  if (!(this instanceof FanboyTransform)) {
    return new FanboyTransform(db, opts)
  }
  this.db = db

  if (!(opts instanceof Opts)) {
    opts = defaults(opts)
  }

  const sopts = new TransformOpts(opts.highWaterMark)
  stream.Transform.call(this, sopts)

  Object.assign(this, opts)

  this.decoder = new StringDecoder()
  this.state = 0
  this._readableState.objectMode = opts.objectMode
}
inherits(FanboyTransform, stream.Transform)

FanboyTransform.prototype.decode = function (chunk) {
  return this.decoder.write(chunk).toLowerCase()
}

const TOKENS = ['[', ',', ']\n']
FanboyTransform.prototype.use = function (chunk) {
  if (this._readableState.objectMode) {
    let obj = null
    try {
      obj = JSON.parse(chunk)
    } catch (error) {
      const er = new Error('fanboy: cannot use: ' + error.message)
      this.emit('error', er)
      return true
    }
    return obj !== null ? this.push(obj) : true
  } else {
    const more = this.push(TOKENS[this.state] + chunk)
    this.state = 1
    return more
  }
}

FanboyTransform.prototype.deinit = function () {
  this.cache = null
  this.db = null
  this.result = null
}

FanboyTransform.prototype._flush = function (cb) {
  if (!this._readableState.objectMode) {
    this.push(this.state ? TOKENS[2] : '[]\n')
    this.state = 0
  }
  this.deinit()
  cb()
}

const verbs = { '/search': 'term', '/lookup': 'id' }
function decorate (obj, path, term) {
  obj[verbs[path]] = term
  return obj
}

function mkpath (path, term, media, country, attribute) {
  const obj = (() => {
    if (path === '/lookup') return Object.create(null)
    const o = {
      media: media,
      country: country
    }
    if (attribute) o.attribute = attribute
    return o
  })()

  // Note: URL encoding replaces spaces with the plus (+) character and all
  // characters except the following are encoded: letters, numbers, periods
  // (.), dashes (-), underscores (_), and asterisks (*).

  const q = querystring.stringify(decorate(obj, path, term))
  return [path, q].join('?')
}

function ReqOpts (hostname, keepAlive, port, method, path) {
  this.hostname = hostname
  this.keepAlive = keepAlive
  this.method = method
  this.path = path
  this.port = port
}

FanboyTransform.prototype.reqOpts = function (term) {
  term = term || this.term

  // Anecdotally, it appears that the country selector doesn’t make any difference.

  const p = mkpath(this.path, term, this.media, this.country)
  return new ReqOpts(this.hostname, true, this.port, 'GET', p)
}

// Request lookup iTunes ID or search for term. Optional `keys` are used as
// fallback.
//
// - term String iTunes ID or search term.
// - keys [String] Array of cached keys (optional).
FanboyTransform.prototype._request = function (term, keys, cb) {
  request(term, keys, this, cb)
}

FanboyTransform.prototype.toString = function () {
  return 'fanboy: ' + this.constructor.name
}
