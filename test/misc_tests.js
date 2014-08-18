
var test = require('tap').test
  , fanboy = require('../')
  ;

test('isStale', function (t) {
  var f = fanboy.isStale
  t.ok(!f(Date.now(), 1), 'should not be stale')
  t.ok(!f(Date.now() - 1, 1), 'should not be stale')
  t.ok(f(Date.now() - 2, 1), 'should be stale')
  t.end()
})

test('resOp', function (t) {
  var f = fanboy.resOp
  t.plan(1)
  t.ok(!!JSON.parse(f({guid:0}).value).ts)
  t.end()
})

test('debug', function (t) {
  t.ok((fanboy.debug === fanboy.noop) === !process.env.DEBUG)
  t.end()
})

test('termOp', function (t) {
  var keys = [
    'fnb\x00res\x0012'
  , 'fnb\x00res\x0034'
  , 'fnb\x00res\x0056'
  ]
  var now = Date.now()
  var wanted = [
    { type:'put'
    , key:'fnb\x00trm\x00abc'
    , value:JSON.stringify([now].concat(keys))
    }
  ]
  t.plan(1)
  ;[
    fanboy.termOp('abc', keys, now)
  ].forEach(function (found, i) {
    t.deepEqual(found, wanted[i])
  })
  t.end()
})

test('putOps', function (t) {
  var now = Date.now()
  var results = [
    { guid:12, ts:now }
  , { guid:34, ts:now }
  , { guid:56, ts:now }
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
  , { type:'put', key:'fnb\x00trm\x00abc', value:JSON.stringify([now].concat(keys))}
  ]
  var found = fanboy.putOps('abc', results, now)
  t.plan(1)
  t.deepEqual(found, wanted)
  t.end()
})
