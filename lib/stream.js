'use strict'

// stream.js - Base Transform

const { StringDecoder } = require('string_decoder')
const { Transform } = require('readable-stream')
const querystring = require('querystring')
const { request } = require('./http')
const { Opts, defaults } = require('./init')

exports.mkpath = mkpath

class FanboyTransform extends Transform {
  constructor (db, opts) {
    if (!(opts instanceof Opts)) {
      opts = defaults(opts)
    }

    const { highWaterMark } = opts
    super({ highWaterMark: highWaterMark })

    this.db = db

    Object.assign(this, opts)

    this.decoder = new StringDecoder()
    this.state = 0
    this._readableState.objectMode = opts.objectMode
  }

  decode (chunk) {
    return this.decoder.write(chunk).toLowerCase()
  }

  use (chunk) {
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
      const more = this.push(FanboyTransform.TOKENS[this.state] + chunk)
      this.state = 1
      return more
    }
  }

  deinit () {
    this.cache = null
    this.db = null
    this.result = null
  }

  _flush (cb) {
    if (!this._readableState.objectMode) {
      this.push(this.state ? FanboyTransform.TOKENS[2] : '[]\n')
      this.state = 0
    }
    this.deinit()
    cb()
  }

  reqOpts (term) {
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
  _request (term, keys, cb) {
    request(term, keys, this, cb)
  }

  toString () {
    return 'fanboy: ' + this.constructor.name
  }
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

FanboyTransform.TOKENS = ['[', ',', ']\n']

exports.FanboyTransform = FanboyTransform
