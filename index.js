'use strict'

const LRU = require('lru-cache')
const { debuglog } = require('util')
const { FanboyTransform, defaults, mkpath, guid } = require('./lib/stream')
const { Search } = require('./lib/search')
const { SearchTerms } = require('./lib/suggest')
const { Lookup } = require('./lib/lookup')
const { createResultsParser } = require('./lib/http')
const { createDatabase } = require('./lib/level')

const debug = debuglog('fanboy')

// API

class Fanboy {
  static createState (opts) {
    opts.cache = new LRU({ maxAge: opts.ttl, max: opts.max })

    return opts
  }

  // Creates a new iTunes client, caching with the database located at `name`.
  constructor (name, opts) {
    opts = defaults(opts)

    this.db = createDatabase(name, opts.cacheSize)
    this.state = Fanboy.createState(opts)
  }

  // Returns a new search stream.
  search () {
    return new Search(this.db, this.state)
  }

  // Returns a new lookup stream.
  lookup () {
    return new Lookup(this.db, this.state)
  }

  // Returns a new suggest stream respecting result `limit`.
  suggest (limit) {
    return new SearchTerms(this.db, this.state, limit)
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
  exports.Search = Search
  exports.suggest = SearchTerms
  exports.termOp = termOp
}
