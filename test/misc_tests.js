
var test = require('tap').test
  , fanboy = require('../')

test('putOps', function (t) {
  var f = fanboy.putOps
  t.plan(1)
  var results = [
    { guid:12 }
  , { guid:34 }
  , { guid:56 }
  ]
  var keys = [
    'fnb\x00res\x0012'
  , 'fnb\x00res\x0034'
  , 'fnb\x00res\x0056'
  ]
  var wanted = [
    { type:'put', key:keys[0], value:JSON.stringify(results[0]) }
  , { type:'put', key:keys[1], value:JSON.stringify(results[1]) }
  , { type:'put', key:keys[2], value:JSON.stringify(results[2]) }
  , { type:'put', key:'fnb\x00trm\x00abc', value:keys}
  ]
  var found = f('abc', results)
  t.deepEqual(found, wanted)
  t.end()
})
