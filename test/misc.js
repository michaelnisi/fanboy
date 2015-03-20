
var fanboy = require('../')
var test = require('tap').test

var DIV = '\udbff\udfff'
var END = '\xff'

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
  t.ok((fanboy.debug === fanboy.nop) === !process.env.DEBUG)
  t.end()
})

function str (o) {
  return JSON.stringify(o)
}

test('termOp', function (t) {
  var keys = [
    ['fnb', 'res', '12'].join(DIV)
  , ['fnb', 'res', '34'].join(DIV)
  , ['fnb', 'res', '56'].join(DIV)
  ]
  var now = Date.now()
  var wanted = [
    { type:'put'
    , key:['fnb', 'trm', 'abc'].join(DIV)
    , value:str([now].concat(keys))
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
    ['fnb', 'res', '12'].join(DIV)
  , ['fnb', 'res', '34'].join(DIV)
  , ['fnb', 'res', '56'].join(DIV)
  ]
  var wanted = [
    { type:'put', key:keys[0], value:str(results[0]) }
  , { type:'put', key:keys[1], value:str(results[1]) }
  , { type:'put', key:keys[2], value:str(results[2]) }
  , { type:'put'
    , key:['fnb', 'trm', 'abc'].join(DIV)
    , value:str([now].concat(keys))}
  ]
  var found = fanboy.putOps('abc', results, now)
  t.plan(1)
  t.deepEqual(found, wanted)
  t.end()
})
