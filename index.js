'use strict'

const { EventEmitter } = require('events')
const lru = require('lru-cache')
const util = require('util')

const { FanboyTransform, defaults, mkpath, guid } = require('./lib/stream')
const { Search } = require('./lib/search')
const { SearchTerms } = require('./lib/suggest')
const { Lookup } = require('./lib/lookup')
const { createResultsParser } = require('./lib/http')
const { createDatabase } = require('./lib/level')

const debug = util.debuglog('fanboy')

// API

class Fanboy extends EventEmitter {
  static sharedState (opts) {
    opts.cache = lru({ maxAge: opts.ttl, max: opts.max })
    return opts
  }

  constructor (name, opts) {
    super()

    opts = defaults(opts)

    this.db = createDatabase(name, opts.cacheSize)
    this.opts = Fanboy.sharedState(opts)
  }

  search () {
    return new Search(this.db, this.opts)
  }

  lookup () {
    return new Lookup(this.db, this.opts)
  }

  suggest (limit) {
    return new SearchTerms(this.db, this.opts, limit)
  }
}

exports.Fanboy = Fanboy

// TEST

const TEST = process.mainModule.filename.match(/test/) !== null

if (TEST) {
  const {
    close,
    isStale,
    keyStream,
    termOp,
    resOp,
    putOps
  } = require('./lib/level')

  Fanboy.prototype.close = function (cb) {
    close(this.db, cb)
  }

  exports.base = FanboyTransform
  exports.debug = debug
  exports.defaults = defaults
  exports.guid = guid
  exports.isStale = isStale
  exports.keyStream = keyStream
  exports.lookup = Lookup
  exports.mkpath = mkpath
  exports.nop = () => {}
  exports.parse = createResultsParser
  exports.putOps = putOps
  exports.resOp = resOp
  exports.search = Search
  exports.suggest = SearchTerms
  exports.termOp = termOp
}
