'use strict'

const { defaults, guid, nop } = require('../lib/init')
const { test } = require('tap')

test('defaults', (t) => {
  t.ok(!!defaults())

  const wanted = {
    cache: { get: nop, set: nop, reset: nop },
    country: 'us',
    hostname: 'itunes.apple.com',
    max: 500,
    media: 'podcast',
    port: 80,
    result: guid,
    ttl: 86400000
  }

  nop() // 100

  t.deepEquals(defaults(), wanted)

  t.end()
})
