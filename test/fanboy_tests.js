
var test = require('tap').test
  , fanboy = require('../')

test('Lookup', function (t) {
  t.plan(9)
  var f = fanboy.lookup
  var obj = f()
  t.ok(obj instanceof fanboy.base)
  t.ok(obj instanceof f)
  t.is(obj.toString(), 'fanboy: Lookup')
  t.is(obj.path, '/lookup')
  t.is(typeof obj.info, 'function')
  t.is(typeof obj.error, 'function')
  t.is(typeof obj.reqOpts, 'function')
  t.is(typeof obj.request, 'function')
  t.is(obj.path, '/lookup')
  t.end()
})

test('Fanboy', function (t) {
  t.plan(16)
  var f = fanboy.base
  var obj = f()
  t.ok(obj instanceof f)
  t.is(obj.toString(), 'fanboy: Fanboy')
  t.is(obj.path, '/search')
  t.is(typeof obj.info, 'function')
  t.is(typeof obj.error, 'function')
  t.is(typeof obj.reqOpts, 'function')
  t.is(typeof obj.request, 'function')
  t.is(obj.ttl, 259200000)
  t.is(obj.term, '*')
  t.is(typeof obj.reduce, 'function')
  t.is(obj.port, 443)
  t.is(obj.method, 'GET')
  t.is(obj.media, 'all')
  t.is(obj.log, undefined)
  t.is(obj.country, 'us')
  t.is(obj.path, '/search')
  t.end()
})


test('Search', function (t) {
  t.plan(8)
  var f = fanboy.search
  var inst = f()
  t.ok(inst instanceof fanboy.base)
  t.ok(inst instanceof f)
  t.is(inst.toString(), 'fanboy: Search')
  t.is(inst.path, '/search')
  t.is(typeof inst.info, 'function')
  t.is(typeof inst.error, 'function')
  t.is(typeof inst.reqOpts, 'function')
  t.is(typeof inst.request, 'function')
  t.end()
})
