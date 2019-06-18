'use strict'

const LRU = require('lru-cache')
const { defaults } = require('./lib/init')
const { createDatabase } = require('./lib/level')
const { search } = require('./lib/search')
const { lookup } = require('./lib/lookup')
const { suggest } = require('./lib/suggest')

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
