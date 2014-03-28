
var test = require('tap').test
  , fanboy = require('../')

test('base', function (t) {
  var f = fanboy.base
  var thing = f()
  console.error(thing)

  t.end()
})
