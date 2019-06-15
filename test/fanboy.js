'use strict'

const fanboy = require('../')
const test = require('tap').test

test('Lookup', (t) => {
  const f = fanboy.lookup
  const obj = f()
  t.ok(obj instanceof fanboy.base)
  t.ok(obj instanceof f)
  t.is(obj.toString(), 'fanboy: Lookup')
  t.is(obj.path, '/lookup')
  t.is(typeof obj.reqOpts, 'function')
  t.is(typeof obj._request, 'function')
  t.is(obj.path, '/lookup')
  t.end()
})

test('FanboyTransform', (t) => {
  const f = fanboy.base
  const obj = f()
  t.is(obj.country, 'us')
  t.is(obj.max, 500)
  t.is(obj.media, 'all')
  t.is(obj.path, '/search')
  t.is(obj.port, 80)
  t.is(obj.state, 0)
  t.is(obj.toString(), 'fanboy: FanboyTransform')
  t.is(obj.ttl, 86400000)
  t.is(typeof obj.reqOpts, 'function')
  t.is(typeof obj._request, 'function')
  t.is(typeof obj.result, 'function')
  t.ok(obj instanceof f)
  t.end()
})

test('state', (t) => {
  const f = fanboy.base
  const obj = f()
  t.is(obj.state, 0)
  obj.state = 1
  obj.end()
  t.is(obj.state, 0)
  t.end()
})
