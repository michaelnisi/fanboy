var keys = require('../lib/keys')
var test = require('tap').test

var DIV = '\udbff\udfff'
var END = '\xff'

test('key', function (t) {
  var f = keys.key
  var wanted = [
    ['fnb', 'trm', 'abc'].join(DIV),
    ['fnb', 'res', '123'].join(DIV)
  ]
  var found = [
    f(keys.TRM, 'abc'),
    f(keys.RES, 123)
  ]
  t.plan(wanted.length + 4)
  t.throws(function () { f(null) })
  t.throws(function () { f(undefined) })
  t.throws(function () { f('WTF') })
  t.throws(function () { f('WTF', 'thing') })
  wanted.forEach(function (it) {
    t.same(found.shift(), it)
  })
})

test('range', function (t) {
  var f = keys.range
  var wanted = [
    { start: ['fnb', 'trm', 'abc'].join(DIV),
      end: ['fnb', 'trm', 'abc'].join(DIV) + END,
      limit: 50 },
    { start: ['fnb', 'res', '123'].join(DIV),
      end: ['fnb', 'res', '123'].join(DIV) + END,
      limit: 50 }
  ]
  var found = [
    f(keys.TRM, 'abc'),
    f(keys.RES, 123)
  ]
  t.plan(wanted.length)
  wanted.forEach(function (it) {
    t.same(found.shift(), it)
  })
})

test('trim', function (t) {
  var f = keys.trim
  var wanted = [
    'abc',
    'abc',
    'abc',
    'abc def',
    'abc def',
    '123',
    'abc'
  ]
  var found = [
    f('abc'),
    f(' abc'),
    f(' abc '),
    f(' abc def '),
    f(' abc  def '),
    f(123),
    f(new Buffer('abc'))
  ]
  t.plan(wanted.length)
  wanted.forEach(function (it) {
    t.deepEqual(found.shift(), it)
  })
})
