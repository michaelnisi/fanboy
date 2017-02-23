'use strict'

var common = require('./lib/common')
var fs = require('fs')
var nock = require('nock')
var path = require('path')
var test = require('tap').test

function stream (scope, term) {
  scope.get('/search?media=podcast&country=us&term=' + term).reply(200,
    function (uri, body) {
      var p = path.join(__dirname, 'data', term + '.json')
      return fs.createReadStream(p)
    }
  )
}

test('flowing mode', { skip: false }, function (t) {
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
  f.on('end', function () {
    var items = JSON.parse(buf)
    t.is(items.length, 13)
    t.ok(scope.isDone())
    common.teardown(cache, function () {
      t.pass('should teardown')
    })
  })
})

test('read', { skip: false }, function (t) {
  t.plan(3)
  var scope = nock('http://itunes.apple.com')
  stream(scope, 'apple')
  var cache = common.freshCache(0)
  var f = cache.search()
  var buf = ''
  f.end('apple')
  f.on('readable', function () {
    var chunk
    while ((chunk = f.read())) {
      buf += chunk
    }
  })
  f.on('end', function () {
    var items = JSON.parse(buf)
    t.is(items.length, 50)
    t.ok(scope.isDone())
    common.teardown(cache, function () {
      t.pass('should teardown')
    })
  })
})

test('not found', { skip: false }, function (t) {
  t.plan(3)
  var cache = common.freshCache()
  var f = cache.search()
  f.keysForTerm('abc', function (er, keys) {
    t.ok(er.notFound, 'should error not found')
    t.is(keys, undefined)
    common.teardown(cache, function () {
      t.pass('should teardown')
    })
  })
})

test('no results', { skip: false }, function (t) {
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
    common.teardown(cache, function () {
      t.pass('should teardown')
    })
  })
  f.end('xoxoxo')
  f.resume()
})

test('database closed', (t) => {
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
