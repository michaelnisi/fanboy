'use strict'

exports = module.exports = Fanboy

const events = require('events')
const lru = require('lru-cache')
const util = require('util')

const { FanboyTransform, defaults, mkpath, guid } = require('./lib/stream')
const { Search } = require('./lib/search')
const { SearchTerms } = require('./lib/suggest')
const { createResultsParser } = require('./lib/http')

const {
  createDatabase,
  close,
  resultForID,
  isStale,
  keyStream,
  termOp,
  resOp,
  putOps
} = require('./lib/level')

const debug = util.debuglog('fanboy')

const TEST = process.mainModule.filename.match(/test/) !== null

function nop () {}

function sharedState (opts) {
  opts.cache = lru({ maxAge: opts.ttl, max: opts.max })
  return opts
}

// API

function Fanboy (name, opts) {
  if (!(this instanceof Fanboy)) return new Fanboy(name, opts)
  events.EventEmitter.call(this)
  opts = defaults(opts)
  this.db = createDatabase(name, opts.cacheSize)
  this.opts = sharedState(opts)
}
util.inherits(Fanboy, events.EventEmitter)

Fanboy.prototype.search = function () {
  return new Search(this.db, this.opts)
}

Fanboy.prototype.lookup = function () {
  return new Lookup(this.db, this.opts)
}

Fanboy.prototype.suggest = function (limit) {
  return new SearchTerms(this.db, this.opts, limit)
}

// --

if (TEST) {
  Fanboy.prototype.close = function (cb) {
    close(this.db, cb)
  }
}

// Lookup item in store
function Lookup (db, opts) {
  if (!(this instanceof Lookup)) return new Lookup(db, opts)
  FanboyTransform.call(this, db, opts)
  this.path = '/lookup'
}
util.inherits(Lookup, FanboyTransform)

// - chunk iTunes ID (e.g. '537879700')
Lookup.prototype._transform = function (chunk, enc, cb) {
  if (this.db.isClosed()) {
    return cb(new Error('fanboy: database closed'))
  }

  const db = this.db
  const guid = this.decode(chunk)

  debug('looking up: %s', guid)

  if (!parseInt(guid, 10)) {
    this.emit('error', new Error('fanboy: guid ' + guid + ' is not a number'))
    return cb()
  }

  resultForID(db, guid, (er, value) => {
    if (er) {
      if (er.notFound) {
        return this._request(guid, cb)
      }
    } else if (value !== undefined) {
      this.use(value)
    }
    cb(er)
  })
}

if (TEST) {
  exports.base = FanboyTransform
  exports.debug = debug
  exports.defaults = defaults
  exports.guid = guid
  exports.isStale = isStale
  exports.keyStream = keyStream
  exports.lookup = Lookup
  exports.mkpath = mkpath
  exports.nop = nop
  exports.parse = createResultsParser
  exports.putOps = putOps
  exports.resOp = resOp
  exports.search = Search
  exports.suggest = SearchTerms
  exports.termOp = termOp
}
