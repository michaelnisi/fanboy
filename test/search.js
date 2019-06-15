'use strict'

const common = require('./lib/common')
const fs = require('fs')
const nock = require('nock')
const path = require('path')
const { test } = require('tap')
const { Search } = require('../lib/search')
const { FanboyTransform } = require('../lib/stream')

test('internals', (t) => {
  const it = new Search()

  t.ok(it instanceof FanboyTransform)
  t.ok(it instanceof Search)
  t.is(it.toString(), 'fanboy: Search')
  t.is(it.path, '/search')
  t.is(typeof it._request, 'function')

  t.end()
})

function stream (scope, term) {
  scope.get('/search?media=podcast&country=us&term=' + term).reply(200,
    function (uri, body) {
      var p = path.join(__dirname, 'data', term + '.json')
      return fs.createReadStream(p)
    }
  )
}

test('flowing mode', t => {
  t.plan(3)
  var scope = nock('http://itunes.apple.com')
  stream(scope, 'gruber')
  var cache = common.freshCache()
  var f = cache.search()
  var buf = ''
  f.end('gruber')
  f.on('data', function (chunk) {
    buf += chunk
  })
  f.on('end', () => {
    var items = JSON.parse(buf)
    t.is(items.length, 13)
    t.ok(scope.isDone())
    common.teardown(cache, () => {
      t.pass('should teardown')
    })
  })
})

test('flowing with limited buffering', t => {
  t.plan(3)

  const scope = nock('http://itunes.apple.com')

  stream(scope, 'apple')

  const cache = common.freshCache(4096)
  const f = cache.search()

  let chunks = []

  f.end('apple')

  f.on('data', (chunk) => {
    chunks.push(chunk)
  })

  f.on('end', () => {
    const payload = Buffer.concat(chunks)
    const items = JSON.parse(payload)

    t.is(items.length, 50)
    t.ok(scope.isDone())

    common.teardown(cache, () => {
      t.pass('should teardown')
    })
  })
})

test('flowing without buffering', t => {
  t.plan(3)

  const scope = nock('http://itunes.apple.com')

  stream(scope, 'apple')

  const cache = common.freshCache(0)
  const f = cache.search()

  let chunks = []

  f.end('apple')

  f.on('data', (chunk) => {
    chunks.push(chunk)
  })

  f.on('end', () => {
    const payload = Buffer.concat(chunks)
    const items = JSON.parse(payload)

    t.is(items.length, 50)
    t.ok(scope.isDone())

    common.teardown(cache, () => {
      t.pass('should teardown')
    })
  })
})

test('not found', t => {
  t.plan(3)
  var cache = common.freshCache()
  var f = cache.search()
  f.keysForTerm('abc', function (er, keys) {
    t.ok(er.notFound, 'should error not found')
    t.is(keys, undefined)
    common.teardown(cache, () => {
      t.pass('should teardown')
    })
  })
})

test('no results', t => {
  t.plan(3)
  var scope = nock('http://itunes.apple.com')
    .get('/search?media=podcast&country=us&term=xoxoxo')
    .reply(200, function (uri, body) {
      return ''
    })
  var cache = common.freshCache()
  var f = cache.search()
  var buf = ''
  f.on('data', function (chunk) {
    buf += chunk
  })
  f.on('end', function (er) {
    var wanted = []
    var found = JSON.parse(buf)
    t.same(wanted, found)
    t.ok(scope.isDone())
    common.teardown(cache, () => {
      t.pass('should teardown')
    })
  })
  f.end('xoxoxo')
  f.resume()
})

test('database closed', t => {
  const cache = common.freshCache()
  const f = cache.search()
  cache.db.close((er) => {
    if (er) throw er
    f.on('error', (er) => {
      t.is(er.message, 'fanboy: database closed')
      common.teardown(cache, () => {
        t.end()
      })
    })
    f.write('abc')
  })
})
