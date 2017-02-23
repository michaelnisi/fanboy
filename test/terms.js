'use strict'

const common = require('./lib/common')
const keys = require('../lib/keys')
const StringDecoder = require('string_decoder').StringDecoder
const test = require('tap').test

const decoder = new StringDecoder('utf8')

function decode (buf) {
  return decoder.write(buf)
}

const cache = common.freshCache()

test('no results', (t) => {
  t.plan(1)
  const f = cache.suggest()
  let buf = ''
  f.on('data', (chunk) => {
    buf += chunk
  })
  f.on('end', () => {
    const found = JSON.parse(decode(buf))
    const wanted = []
    t.deepEqual(found, wanted)
  })
  f.end('xoxoxo')
})

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

  t.plan(2)

  db.batch(puts, (er) => {
    t.ok(!er)
    let buf = ''
    const f = cache.suggest()
    f.on('readable', () => {
      let chunk
      while ((chunk = f.read()) !== null) {
        buf += chunk
      }
    })
    f.write('a')
    f.write('ab')
    f.write('abc')
    f.end('abcd')
    f.on('end', () => {
      const found = JSON.parse(decode(buf))
      const wanted = ['abc', 'abc', 'abc']
      t.deepEqual(found, wanted)
    })
  })
})

test('database closed', (t) => {
  cache.db.close((er) => {
    if (er) throw er
    const s = cache.suggest()
    s.on('error', (er) => {
      t.is(er.message, 'fanboy: database closed')
      s.resume()
    })
    s.on('end', () => {
      t.end()
    })
    s.end('abc')
  })
})

test('teardown', (t) => {
  common.teardown(cache, () => {
    t.end()
  })
})
