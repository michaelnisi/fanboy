

// TODO: search_tests.js

var test = require('tap').test
  , Search = require('../').Search

test('search', function (t) {
  var search = new Search()
  search.write('pritlove', 'utf8', function (er) {
    t.end()
  })
  search.pipe(process.stderr)
})


