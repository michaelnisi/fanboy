'use strict'

const { defaults, guid, nop } = require('../lib/init')
const { test } = require('tap')

test('defaults', (t) => {
  t.ok(!!defaults())

  const wanted = {
    cache: { get: nop, set: nop, reset: nop },
    cacheSize: 8388608,
    country: 'us',
    highWaterMark: undefined,
    hostname: 'itunes.apple.com',
    max: 500,
    media: 'all',
    objectMode: false,
    path: '/search',
    port: 80,
    result: guid,
    ttl: 86400000
  }

  t.deepEquals(defaults(), wanted)

  t.end()
})