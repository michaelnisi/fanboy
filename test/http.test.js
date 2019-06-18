'use strict'

const test = require('tap').test
const { createPath, request } = require('../lib/v2/http')

test('creating iTunes API path', t => {
  t.is(createPath('/search', 'apple'), '/search?media=all&country=us&term=apple')
  t.is(createPath('/lookup', '123'), '/lookup?id=123')
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
      t.is(er.message, 'fanboy: getaddrinfo ENOTFOUND xxx xxx:12345')
      t.is(res, undefined)
      t.end()
    } },
  { hostname: 'xxx', port: 12345 }
  ).end()
})
