
var keys = require('../lib/keys')
var test = require('tap').test

test('key', function (t) {
  var f = keys.key
  t.plan(6)
  t.throws(function () { f(null) })
  t.throws(function () { f(undefined) })
  t.throws(function () { f('WTF') })
  t.throws(function () { f('WTF', 'thing') })
  var wanted = [
    'fnb\x00trm\x00abc'
  , 'fnb\x00res\x00123'
  ]
  ;[
    f(keys.TRM, 'abc')
  , f(keys.RES, 123)
  ].forEach(function (found, i) {
    t.is(found, wanted[i])
  })
  t.end()
})

test('range', function (t) {
  var f = keys.range
  t.plan(2)
  var wanted = [
    { start:'fnb\x00trm\x00abc', end:'fnb\x00trm\x00abcÿ', limit:10 }
  , { start: 'fnb\x00res\x00123', end:'fnb\x00res\x00123ÿ', limit:10 }
  ]
  ;[
    f(keys.TRM, 'abc')
  , f(keys.RES, 123)
  ].forEach(function (found, i) {
    t.deepEqual(found, wanted[i])
  })
  t.end()
})

test('trim', function (t) {
  var f = keys.trim
  t.plan(5)
  var wanted = [
    'abc'
  , 'abc'
  , 'abc'
  , 'abc def'
  , 'abc def'
  ]
  ;[
    f('abc')
  , f(' abc')
  , f(' abc ')
  , f(' abc def ')
  , f(' abc  def ')
  ].forEach(function (found, i) {
    t.deepEqual(found, wanted[i])
  })
  t.end()
})
