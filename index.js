'use strict'

const LRU = require('lru-cache')
const { defaults } = require('./lib/init')
const { createDatabase } = require('./lib/level')
const { search } = require('./lib/search')
const { lookup } = require('./lib/lookup')
const { suggest } = require('./lib/suggest')

class Fanboy {
  // Cache using the database at `location`.
  constructor (location, opts) {
    opts = defaults(opts)
    opts.db = createDatabase(location, opts.cacheSize)
    opts.cache = new LRU({ maxAge: opts.ttl, max: opts.max })

    Object.assign(this, opts)
  }

  search (term, onItems) {
    search(term, this, onItems)
  }

  lookup (guid, onItem) {
    lookup(guid, this, onItem)
  }

  suggest (term, onTerms) {
    suggest(term, this, onTerms)
  }
}

exports.Fanboy = Fanboy

const TEST = process.mainModule.filename.match(/test/) !== null

if (TEST) {
  const { close } = require('./lib/level')

  Fanboy.prototype.close = function (cb) {
    close(this.db, cb)
  }
}
