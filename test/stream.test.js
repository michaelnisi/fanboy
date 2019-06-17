'use strict'

const { test } = require('tap')
const { FanboyTransform } = require('../lib/stream')

test('FanboyTransform', t => {
  const it = new FanboyTransform()

  t.is(it.country, 'us')
  t.is(it.max, 500)
  t.is(it.media, 'podcast')
  t.is(it.port, 80)
  t.is(it.state, 0)
  t.is(it.toString(), 'fanboy: FanboyTransform')
  t.is(it.ttl, 86400000)
  t.is(typeof it.reqOpts, 'function')
  t.is(typeof it._request, 'function')
  t.is(typeof it.result, 'function')
  t.ok(it instanceof FanboyTransform)

  t.end()
})

test('state', (t) => {
  const it = new FanboyTransform()

  t.is(it.state, 0)

  it.state = 1

  it.end()
  t.is(it.state, 0)

  t.end()
})
