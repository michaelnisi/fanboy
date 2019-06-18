'use strict'

const common = require('./lib/common')
const keys = require('../lib/keys')
const test = require('tap').test

const cache = common.freshCache()

test('suggest', (t) => {
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

    cache.ssuggest('a', (er, terms) => {
      if (er) throw er
      t.deepEqual(terms, ['abc'])
      t.end()
    })
  })
})

test('teardown', (t) => {
  common.teardown(cache, () => {
    t.end()
  })
})
