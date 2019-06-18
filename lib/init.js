'use strict'

// init.js - configure this caching proxy

const { guid } = require('./level')

exports.Opts = Opts
exports.defaults = defaults
exports.guid = guid
exports.nop = nop
exports.env = env

function env () {
  return new Opts()
}

function nop () {}

function Opts (
  cache = { set: nop, get: nop, reset: nop },
  country = process.env.FANBOY_COUNTRY || 'us',
  hostname = process.env.FANBOY_HOSTNAME || 'itunes.apple.com',
  max = process.env.FANBOY_MAX || 500,
  media = process.env.FANBOY_MEDIA || 'podcast',
  objectMode = false,
  port = process.env.FANBOY_PORT || 80,
  result = guid,
  ttl = process.env.FANBOY_TTL || 24 * 36e5
) {
  this.cache = cache
  this.country = country
  this.result = result
  this.hostname = hostname
  this.max = max
  this.media = media
  this.objectMode = objectMode
  this.port = port
  this.ttl = ttl
}

/**
 * Returns completed `opts` with values from the process environment
 * ('FANBOY_' prefixed) and defaults.
 */
function defaults (opts = Object.create(null)) {
  return new Opts(
    opts.cache,
    opts.country,
    opts.hostname,
    opts.max,
    opts.media,
    opts.objectMode,
    opts.port,
    opts.result,
    opts.ttl
  )
}
