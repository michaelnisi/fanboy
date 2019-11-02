'use strict'

const LRU = require('lru-cache')
const { defaults } = require('./lib/init')
const { search } = require('./lib/search')
const { lookup } = require('./lib/lookup')
const { suggest } = require('./lib/suggest')
const { createLevelDB } = require('./lib/level')

class Fanboy {
  /**
   * Creates a new Fanboy cache.
   * @param {*} db The [Level](https://github.com/Level) database for storage.
   * @param {*} opts Some optional configuration.
   */
  constructor (db, opts) {
    opts = defaults(opts)

    Object.assign(this, opts)

    this.db = db
    this.cache = new LRU({ maxAge: opts.ttl, max: opts.max })
  }

  search (term, onItems) {
    search(term, this, onItems)
  }

  lookup (guid, onItem) {
    lookup(guid, this, onItem)
  }

  suggest (term, limit, onTerms) {
    const cb = typeof limit === 'function' ? limit : onTerms

    suggest(term, this, cb)
  }
}

exports.createLevelDB = createLevelDB
exports.Fanboy = Fanboy
