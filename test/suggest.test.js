'use strict'

const common = require('./lib/common')
const keys = require('../lib/keys')
const test = require('tap').test

test('suggest', (t) => {
  const cache = common.freshCache()
  const db = cache.db

  function key (term) {
    return keys.key(keys.TRM, term)
  }

  function put (term) {
    return { type: 'put', key: key(term), value: term.toUpperCase() }
  }

  const terms = ['abc', 'def', 'ghi']

  const puts = terms.map((term) => {
    return put(term)
  })

  db.batch(puts, (er) => {
    if (er) throw er

    cache.suggest('a', (er, terms) => {
      if (er) throw er
      t.deepEqual(terms, ['abc'])
      t.end()
    })
  })
})

test('database closed', (t) => {
  const cache = common.freshCache()

  cache.db.close(er => {
    if (er) throw er

    cache.suggest('a', (er, terms) => {
      t.is(er.message, 'Database is closed')

      common.teardown(cache, () => {
        t.pass('should teardown')
        t.end()
      })
    })
  })
})
