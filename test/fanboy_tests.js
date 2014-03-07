

// TODO: search_tests.js

var test = require('tap').test
  , Search = require('../').Search

test('search', function (t) {
  var search = Search()
  t.ok(search instanceof Search)
  t.end()
})
