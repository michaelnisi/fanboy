'use strict'

const common = require('./lib/common')
const fs = require('fs')
const nock = require('nock')
const path = require('path')
const test = require('tap').test

function createScope (protocol = 'http:') {
  return nock(`${protocol}//itunes.apple.com`)
    .get('/lookup?id=537879700')
    .reply(200, (uri, body) => {
      const p = path.join(__dirname, 'data', '537879700.json')

      return fs.createReadStream(p)
    })
}

test('uncached item 443', t => {
  const cache = common.freshCache()
  cache.port = 443

  const scope = createScope('https:')

  cache.lookup('537879700', (er, item) => {
    if (er) throw er

    t.is(item.guid, 537879700)
    t.ok(scope.isDone())

    common.teardown(cache, () => {
      t.pass('should teardown')
      t.end()
    })
  })
})

test('uncached item', t => {
  const scope = createScope()
  const cache = common.freshCache()

  cache.lookup('537879700', (er, item) => {
    if (er) throw er

    t.is(item.guid, 537879700)
    t.ok(scope.isDone())

    common.teardown(cache, () => {
      t.pass('should teardown')
      t.end()
    })
  })
})

test('cached item', t => {
  const scope = createScope()
  const cache = common.freshCache()

  cache.lookup('537879700', (er, item) => {
    if (er) throw er

    t.is(item.guid, 537879700)
    t.ok(scope.isDone())

    cache.lookup('537879700', (er, item) => {
      if (er) throw er

      t.is(item.collectionId, 537879700)

      common.teardown(cache, () => {
        t.pass('should teardown')
        t.end()
      })
    })
  })
})

test('invalid guid', (t) => {
  const cache = common.freshCache()

  cache.lookup('hello', (er, item) => {
    t.is(er.message, 'invalid iTunes ID')
    t.is(item, item, undefined)
    t.end()
  })
})

test('unexpected HTTP status code', t => {
  const scope = nock('http://itunes.apple.com')

  scope.get('/lookup?id=123').reply(404)

  const cache = common.freshCache()

  cache.lookup('123', (er, item) => {
    t.is(er.message, 'unexpected HTTP status code: 404')
    t.is(item, undefined)
    t.ok(scope.isDone())

    common.teardown(cache, () => {
      t.pass('should teardown')
      t.end()
    })
  })
})

test('parse error', t => {
  const scope = nock('http://itunes.apple.com')

  scope.get('/lookup?id=123')
    .reply(200, (uri, body) => {
      return 'hello, here dog'
    })

  const cache = common.freshCache()

  cache.lookup('123', (er, item) => {
    t.is(er.message, 'Invalid JSON (Unexpected "h" at position 0 in state STOP)')
    t.is(item, undefined)
    t.ok(scope.isDone())

    common.teardown(cache, () => {
      t.pass('should teardown')
      t.end()
    })
  })
})

test('no response', t => {
  const scope = nock('http://itunes.apple.com')

  scope.get('/lookup?id=123').reply(200)

  const cache = common.freshCache()

  cache.lookup('123', (er, item) => {
    t.is(er.message, 'nothing to read')
    t.is(item, undefined)
    t.ok(scope.isDone())

    common.teardown(cache, () => {
      t.pass('should teardown')
      t.end()
    })
  })
})

test('socket timeout', t => {
  const scope = nock('http://itunes.apple.com')

  scope.get('/lookup?id=123')
    .socketDelay(5000)
    .reply(200, (uri, body) => {
      return 'hello, here dog'
    })

  const cache = common.freshCache()

  cache.lookup('123', (er, item) => {
    t.is(er.message, 'fanboy: socket hang up')
    t.is(item, undefined)
    t.ok(scope.isDone())

    common.teardown(cache, () => {
      t.pass('should teardown')
      t.end()
    })
  })
})

test('database closed', (t) => {
  const cache = common.freshCache()

  cache.db.close(er => {
    if (er) throw er

    cache.lookup('537879700', (er, item) => {
      t.is(er.message, 'Database is not open')
      t.is(item, undefined)

      common.teardown(cache, () => {
        t.pass('should teardown')
        t.end()
      })
    })
  })
})
