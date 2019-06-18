'use strict'

const LRU = require('lru-cache')
const { defaults } = require('./lib/init')
const { Search } = require('./lib/search')
const { SearchTerms } = require('./lib/suggest')
const { Lookup } = require('./lib/lookup')
const { createDatabase } = require('./lib/level')
const { search } = require('./lib/v2/search')
const { lookup } = require('./lib/v2/lookup')
const { suggest } = require('./lib/v2/suggest')

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

  // MARK:

  ssearch (term, onItems) {
    // TODO: Adjust so we can pass this directly.
    const context = { db: this.db, ttl: this.state.ttl, cache: this.state.cache }
    search(term, context, onItems)
  }

  llookup (guid, onItem) {
    // TODO: Adjust so we can pass this directly. lookup(guid, this, onItem)
    const context = { db: this.db, ttl: this.state.ttl, cache: this.state.cache }
    lookup(guid, context, onItem)
  }

  ssuggest (term, onTerms) {
    const context = { db: this.db, limit: 50 }
    suggest(term, context, onTerms)
  }
}

exports.Fanboy = Fanboy

// TEST

const TEST = process.mainModule.filename.match(/test/) !== null

if (TEST) {
  const { close } = require('./lib/level')

  Fanboy.prototype.close = function (cb) {
    close(this.db, cb)
  }
}
