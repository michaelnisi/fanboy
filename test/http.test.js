'use strict'

const test = require('tap').test
const { createPath, request, ReqOpts } = require('../lib/http')

test('default request options', t => {
  const wanted = {
    hostname: 'localhost',
    keepAlive: true,
    port: 8080,
    method: 'GET',
    path: '/'
  }

  t.same(new ReqOpts(), wanted)
  t.end()
})

test('creating iTunes API path', t => {
  t.is(createPath('/search', 'apple'), '/search?media=all&country=us&term=apple')
  t.is(createPath('/lookup', '123'), '/lookup?id=123')

  t.is(
    createPath('/search', 'shiba', { attribute: 'breed' }),
    '/search?media=all&country=us&attribute=breed&term=shiba'
  )

  t.throws(() => { createPath('/hello', 'dog') })
  t.end()
})

test('aborted', t => {
  const req = request({
    path: '/search',
    term: 'abortion',
    responseHandler: (er, res) => {
      t.is(er.message, 'fanboy: request aborted')
      t.is(res, undefined)
      t.end()
    }
  })

  req.abort()
})

test('failed request', t => {
  request({
    path: '/search',
    term: 'xxx',
    responseHandler: (er, res) => {
      t.ok(er.message.indexOf('ENOTFOUND'))
      t.is(res, undefined)
      t.end()
    }
  },
  { hostname: 'xxx', port: 12345 }
  ).end()
})
