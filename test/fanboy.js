var fanboy = require('../')
var test = require('tap').test

test('defaults', function (t) {
  var f = fanboy.defaults
  t.plan(2)
  t.ok(!!f())
  var wanted = {
    cache: { get: fanboy.nop, set: fanboy.nop, reset: fanboy.nop },
    cacheSize: null,
    country: 'us',
    highWaterMark: undefined,
    hostname: 'itunes.apple.com',
    max: 500,
    media: 'all',
    method: 'GET',
    objectMode: false,
    path: '/search',
    port: 80,
    reduce: fanboy.reduce,
    ttl: 86400000
  }
  t.deepEquals(f(), wanted)
  t.end()
})

test('Lookup', function (t) {
  t.plan(7)
  var f = fanboy.lookup
  var obj = f()
  t.ok(obj instanceof fanboy.base)
  t.ok(obj instanceof f)
  t.is(obj.toString(), 'fanboy: Lookup')
  t.is(obj.path, '/lookup')
  t.is(typeof obj.reqOpts, 'function')
  t.is(typeof obj.request, 'function')
  t.is(obj.path, '/lookup')
  t.end()
})

test('FanboyTransform', function (t) {
  t.plan(14)
  var f = fanboy.base
  var obj = f()
  t.ok(obj instanceof f)
  t.is(obj.toString(), 'fanboy: FanboyTransform')
  t.is(obj.path, '/search')
  t.is(typeof obj.reqOpts, 'function')
  t.is(typeof obj.request, 'function')
  t.is(obj.ttl, 86400000)
  t.is(typeof obj.reduce, 'function')
  t.is(obj.port, 80)
  t.is(obj.max, 500)
  t.is(obj.method, 'GET')
  t.is(obj.media, 'all')
  t.is(obj.country, 'us')
  t.is(obj.path, '/search')
  t.is(obj.state, 0)
  t.end()
})

test('state', function (t) {
  t.plan(2)
  var f = fanboy.base
  var obj = f()
  t.is(obj.state, 0)
  obj.state = 1
  obj.end()
  t.is(obj.state, 0)
  t.end()
})

test('Search', function (t) {
  t.plan(5)
  var f = fanboy.search
  var inst = f()
  t.ok(inst instanceof fanboy.base)
  t.ok(inst instanceof f)
  t.is(inst.toString(), 'fanboy: Search')
  t.is(inst.path, '/search')
  t.is(typeof inst.request, 'function')
  t.end()
})
