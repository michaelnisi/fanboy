'use strict'

const common = require('./lib/common')
const fs = require('fs')
const nock = require('nock')
const path = require('path')
const test = require('tap').test

test('invalid guid', (t) => {
  t.plan(2)
  const cache = common.freshCache()
  const f = cache.lookup()
  f.on('error', (er) => {
    t.is(er.message, 'fanboy: guid x is not a number')
  })
  f.on('end', () => {
    t.pass('should end')
  })
  f.write('x')
  f.end()
  f.resume()
})

test('simple', (t) => {
  t.plan(4)
  const scope = nock('http://itunes.apple.com')
    .get('/lookup?id=537879700')
    .reply(200, (uri, body) => {
      t.comment(uri)
      const p = path.join(__dirname, 'data', '537879700.json')
      return fs.createReadStream(p)
    })
  const cache = common.freshCache()
  const f = cache.lookup()
  f.write('537879700')
  f.end()
  let buf = ''
  f.on('data', (chunk) => {
    buf += chunk
  })
  f.on('end', () => {
    const items = JSON.parse(buf)
    t.is(items.length, 1)
    const found = items[0]
    t.is(found.guid, 537879700)
    t.ok(scope.isDone())
    common.teardown(cache, () => {
      t.pass('should teardown')
    })
  })
})

test('database closed', (t) => {
  const cache = common.freshCache()
  const f = cache.lookup()
  cache.db.close((er) => {
    if (er) throw er
    f.on('error', (er) => {
      t.is(er.message, 'fanboy: database closed')
      common.teardown(cache, () => {
        t.end()
      })
    })
    f.write('123')
  })
})
