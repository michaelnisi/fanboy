'use strict'

const common = require('./lib/common')
const fs = require('fs')
const nock = require('nock')
const path = require('path')
const test = require('tap').test
const { Lookup } = require('../lib/lookup')
const { FanboyTransform } = require('../lib/stream')

test('some uncached results', t => {
  const scope = nock('http://itunes.apple.com')
    .get('/lookup?id=537879700')
    .reply(200, (uri, body) => {
      t.comment(uri)

      const p = path.join(__dirname, 'data', '537879700.json')

      return fs.createReadStream(p)
    }
    )

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

test('internals', (t) => {
  const obj = new Lookup()

  t.ok(obj instanceof FanboyTransform)
  t.ok(obj instanceof Lookup)
  t.is(obj.toString(), 'fanboy: Lookup')
  t.is(obj.path, '/lookup')
  t.is(typeof obj.reqOpts, 'function')
  t.is(typeof obj._request, 'function')
  t.is(obj.path, '/lookup')

  t.end()
})

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
