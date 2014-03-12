
var test = require('tap').test
  , keys = require('../lib/keys')

test('keys', function (t) {
  var f = keys.key
  t.plan(5)
  t.throws(function () { f(null) })
  t.throws(function () { f(undefined) })
  t.throws(function () { f('WTF') })
  t.throws(function () { f('WTF', 'thing') })
  var wanted = [
    'trm\u0000abc'
  ]
  ;[
    f(keys.TRM, 'abc')
  ].forEach(function (found, i) {
    t.is(found, wanted[i])
  })
  t.end()
})


