'use strict'

// init.js - configure this caching proxy

exports.Opts = Opts
exports.defaults = defaults
exports.guid = guid
exports.nop = nop

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
