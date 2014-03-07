
var test = require('tap').test
  , SearchOpts = require('../').SearchOpts

test('defaults', function (t) {
  t.plan(1)
  var wanted = {
    hostname: 'itunes.apple.com'
  , port: 443
  , method: 'GET'
  , path: '/search?term=*&media=all&country=us'
  }
  var found = new SearchOpts().reqOpts()
  t.deepEquals(found, wanted)
  t.end()
})
