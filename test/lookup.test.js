'use strict'

const common = require('./lib/common')
const fs = require('fs')
const nock = require('nock')
const path = require('path')
const test = require('tap').test

test('an uncached result', t => {
  const scope = nock('http://itunes.apple.com')
    .get('/lookup?id=537879700')
    .reply(200, (uri, body) => {
      t.comment(uri)

      const p = path.join(__dirname, 'data', '537879700.json')

      return fs.createReadStream(p)
    })

  const cache = common.freshCache()

  cache.llookup('537879700', (er, item) => {
    if (er) throw er

    t.is(item.guid, 537879700)
    t.ok(scope.isDone())

    common.teardown(cache, () => {
      t.pass('should teardown')
      t.end()
    })
  })
})

test('invalid guid', (t) => {
  const cache = common.freshCache()

  cache.llookup('hello', (er, item) => {
    t.is(er.message, 'invalid iTunes ID')
    t.is(item, item, undefined)
    t.end()
  })
})

test('database closed', (t) => {
  const cache = common.freshCache()

  cache.close(er => {
    if (er) throw er

    cache.llookup('537879700', (er, item) => {
      t.is(er.message, 'Database is not open')
      t.is(item, undefined)

      common.teardown(cache, () => {
        t.pass('should teardown')
        t.end()
      })
    })
  })
})
