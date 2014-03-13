
var test = require('tap').test
  , fanboy = require('../')

test('parse', function (t) {
  var f = fanboy.parse
  t.plan(3)
  t.throws(function () { f(undefined) })
  t.throws(function () { f(null) })
  var wanted = [
    [123, '[']
  ]
  ;[
    f('123[')
  ].forEach(function (found, i) {
    t.deepEqual(found, wanted[i])
  })
  t.end()
})

test('stringify', function (t) {
  var f = fanboy.stringify
  t.plan(4)
  t.throws(function () { f(undefined) })
  t.throws(function () { f(null) })
  t.ok(!!f)
  var now = new Date().getTime()
  var wanted = [
    [parseInt(now), '[{"title":"abc"}]'].join('')
  ]
  ;[
    f([{title:'abc'}], now)
  ].forEach(function (found, i) {
    t.deepEqual(found, wanted[i])
  })
  t.end()
})
