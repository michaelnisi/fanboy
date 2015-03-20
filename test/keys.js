
var keys = require('../lib/keys')
var test = require('tap').test

var DIV = '\udbff\udfff'
var END = '\xff'

test('key', function (t) {
  var f = keys.key
  t.plan(6)
  t.throws(function () { f(null) })
  t.throws(function () { f(undefined) })
  t.throws(function () { f('WTF') })
  t.throws(function () { f('WTF', 'thing') })
  var wanted = [
    ['fnb', 'trm', 'abc'].join(DIV)
  , ['fnb', 'res', '123'].join(DIV)
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
    { start:['fnb', 'trm', 'abc'].join(DIV)
    , end:['fnb', 'trm', 'abc'].join(DIV) + END
    , limit:50 }
  , { start: ['fnb', 'res', '123'].join(DIV)
    , end:['fnb', 'res', '123'].join(DIV) + END
    , limit:50 }
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
  var wanted = [
    'abc'
  , 'abc'
  , 'abc'
  , 'abc def'
  , 'abc def'
  , '123'
  , 'abc'
  ]
  ;[
    f('abc')
  , f(' abc')
  , f(' abc ')
  , f(' abc def ')
  , f(' abc  def ')
  , f(123)
  , f(new Buffer('abc'))
  ].forEach(function (found, i) {
    t.deepEqual(found, wanted[i])
  })
  t.end()
})
