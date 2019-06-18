'use strict'

const common = require('./lib/common')
const fs = require('fs')
const nock = require('nock')
const path = require('path')
const { test } = require('tap')
const { keysForTerm } = require('../lib/level')

function stream (scope, term) {
  scope.get('/search?media=podcast&country=us&term=' + term).reply(200,
    function (uri, body) {
      var p = path.join(__dirname, 'data', term + '.json')
      return fs.createReadStream(p)
    }
  )
}

test('some uncached results', t => {
  const scope = nock('http://itunes.apple.com')

  stream(scope, 'gruber')

  const cache = common.freshCache()

  cache.search('gruber', (er, results) => {
    if (er) throw er

    t.is(results.length, 13)
    t.ok(scope.isDone())
    common.teardown(cache, () => {
      t.pass('should teardown')
      t.end()
    })
  })
})

test('many uncached results', t => {
  const scope = nock('http://itunes.apple.com')

  stream(scope, 'apple')

  const cache = common.freshCache()

  cache.search('apple', (er, results) => {
    if (er) throw er

    t.is(results.length, 50)
    t.ok(scope.isDone())
    common.teardown(cache, () => {
      t.pass('should teardown')
      t.end()
    })
  })
})

test('no results', t => {
  t.plan(3)

  const scope = nock('http://itunes.apple.com')
    .get('/search?media=podcast&country=us&term=xoxoxo')
    .reply(200, function (uri, body) {
      return JSON.stringify({
        resultsCount: 0,
        results: []
      })
    })

  const cache = common.freshCache()

  cache.search('xoxoxo', (er, results) => {
    if (er) throw er

    t.same(results, [])
    t.ok(scope.isDone())
    common.teardown(cache, () => {
      t.pass('should teardown')
    })
  })
})

test('some cached results', t => {
  const scope = nock('http://itunes.apple.com')

  stream(scope, 'gruber')

  const cache = common.freshCache()

  cache.search('gruber', (er, results) => {
    if (er) throw er

    t.is(results.length, 13)
    t.ok(scope.isDone())

    cache.search('gruber', (er, results) => {
      if (er) throw er

      t.is(results.length, 13)

      common.teardown(cache, () => {
        t.pass('should teardown')
        t.end()
      })
    })
  })
})

test('stale keys', t => {
  const scope = nock('http://itunes.apple.com')

  stream(scope, 'gruber')

  const cache = common.freshCache()

  cache.search('gruber', (er, results) => {
    if (er) throw er

    t.is(results.length, 13)
    t.ok(scope.isDone())

    keysForTerm(cache.db, 'gruber', 0, (er, keys) => {
      t.is(er.message, 'fanboy: stale keys for gruber')
      t.is(keys.length, 13)

      common.teardown(cache, () => {
        t.pass('should teardown')
        t.end()
      })
    })
  })
})

test('unexpected HTTP status code', t => {
  const scope = nock('http://itunes.apple.com')

  scope.get('/search?media=podcast&country=us&term=' + 'hello').reply(404)

  const cache = common.freshCache()

  cache.search('hello', (er, results) => {
    t.is(er.message, 'unexpected HTTP status code: 404')
    t.ok(scope.isDone())
    common.teardown(cache, () => {
      t.pass('should teardown')
      t.end()
    })
  })
})

test('parse error', t => {
  const scope = nock('http://itunes.apple.com')

  scope.get('/search?media=podcast&country=us&term=' + 'dog')
    .reply(200, (uri, body) => {
      return 'hello, here dog'
    })

  const cache = common.freshCache()

  cache.search('dog', (er, results) => {
    t.is(er.message, 'Invalid JSON (Unexpected "h" at position 0 in state STOP)')
    t.ok(scope.isDone())
    common.teardown(cache, () => {
      t.pass('should teardown')
      t.end()
    })
  })
})

test('socket timeout', t => {
  const scope = nock('http://itunes.apple.com')

  scope.get('/search?media=podcast&country=us&term=' + 'dog')
    .socketDelay(5000)
    .reply(200, (uri, body) => {
      return 'hello, here dog'
    })

  const cache = common.freshCache()

  cache.search('dog', (er, results) => {
    t.is(er.message, 'fanboy: socket hang up')
    t.ok(scope.isDone())
    common.teardown(cache, () => {
      t.pass('should teardown')
      t.end()
    })
  })
})

test('no response', t => {
  const scope = nock('http://itunes.apple.com')

  scope.get('/search?media=podcast&country=us&term=' + 'void').reply(200)

  const cache = common.freshCache()

  cache.search('void', (er, results) => {
    t.is(er.message, 'nothing to read')
    t.ok(scope.isDone())
    common.teardown(cache, () => {
      t.pass('should teardown')
      t.end()
    })
  })
})

test('database closed', t => {
  const cache = common.freshCache()

  cache.db.close((er) => {
    if (er) throw er

    cache.search('abc', (er, results) => {
      t.is(er.message, 'Database is not open')
      t.is(results, undefined)
      common.teardown(cache, () => {
        t.end()
      })
    })
  })
})
