'use strict'

const keys = require('../lib/keys')
const test = require('tap').test

const DIV = '\udbff\udfff'
const END = '\xff'

test('key', (t) => {
  const f = keys.key
  const wanted = [
    ['fnb', 'trm', 'abc'].join(DIV),
    ['fnb', 'res', '123'].join(DIV)
  ]
  const found = [
    f(keys.TRM, 'abc'),
    f(keys.RES, 123)
  ]
  t.plan(wanted.length + 4)
  t.throws(() => { f(null) })
  t.throws(() => { f(undefined) })
  t.throws(() => { f('WTF') })
  t.throws(() => { f('WTF', 'thing') })
  wanted.forEach((it) => {
    t.same(found.shift(), it)
  })
})

test('range', (t) => {
  const f = keys.range
  const wanted = [
    { start: ['fnb', 'trm', 'abc'].join(DIV),
      end: ['fnb', 'trm', 'abc'].join(DIV) + END,
      limit: 50 },
    { start: ['fnb', 'res', '123'].join(DIV),
      end: ['fnb', 'res', '123'].join(DIV) + END,
      limit: 50 }
  ]
  const found = [
    f(keys.TRM, 'abc'),
    f(keys.RES, 123)
  ]
  t.plan(wanted.length)
  wanted.forEach((it) => {
    t.same(found.shift(), it)
  })
})

test('trim', (t) => {
  const f = keys.trim
  const wanted = [
    'abc',
    'abc',
    'abc',
    'abc def',
    'abc def',
    '123',
    'abc'
  ]
  const found = [
    f('abc'),
    f(' abc'),
    f(' abc '),
    f(' abc def '),
    f(' abc  def '),
    f(123),
    f(new Buffer('abc'))
  ]
  wanted.forEach((it) => {
    t.deepEqual(found.shift(), it)
  })

  t.throws(() => { f({}) })

  t.end()
})
