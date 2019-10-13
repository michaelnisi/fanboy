'use strict'

const { test } = require('tap')
const common = require('./lib/common')

const {
  isStale,
  resOp,
  termOp,
  putOps,
  keysForTerm,
  guid,
  put
} = require('../lib/level')

test('putting invalid value', t => {
  const { db } = common.freshCache()

  t.throws(() => { put(db, 'dog', [{}]) }, 'not a string, number, or buffer')
  t.end()
})

test('guid', t => {
  t.is(guid(), undefined)
  t.is(guid(null), null)
  t.end()
})

test('empty putting', t => {
  function check (objs) {
    if (!objs.length) return t.end()

    put(null, 'nothing', objs.pop(), er => {
      t.is(er.message, 'fanboy: cannot store empty results')
      check(objs)
    })
  }

  check([undefined, null, []])
})

test('keys not found', t => {
  t.plan(3)

  const cache = common.freshCache()

  keysForTerm(cache.db, 'abc', 0, (er, keys) => {
    t.ok(er.notFound, 'should error not found')
    t.is(keys, undefined)
    common.teardown(cache, () => {
      t.pass('should teardown')
    })
  })
})

var DIV = '\udbff\udfff'

test('isStale', function (t) {
  t.ok(!isStale(Date.now(), 1), 'should not be stale')
  t.ok(isStale(Date.now() - 2, 1), 'should be stale')
  t.end()
})

test('resOp', function (t) {
  t.plan(1)
  t.ok(!!JSON.parse(resOp({ guid: 0 }).value).ts)
  t.end()
})

function str (o) {
  return JSON.stringify(o)
}

test('termOp', function (t) {
  var keys = [
    ['fnb', 'res', '12'].join(DIV),
    ['fnb', 'res', '34'].join(DIV),
    ['fnb', 'res', '56'].join(DIV)
  ]
  var now = Date.now()
  var wanted = [
    {
      type: 'put',
      key: ['fnb', 'trm', 'abc'].join(DIV),
      value: str([now].concat(keys))
    }
  ]
  t.plan(1)
  ;[
    termOp('abc', keys, now)
  ].forEach(function (found, i) {
    t.deepEqual(found, wanted[i])
  })
  t.end()
})

test('putOps', function (t) {
  var now = Date.now()
  var results = [
    { guid: 12, ts: now },
    { guid: 34, ts: now },
    { guid: 56, ts: now }
  ]
  var keys = [
    ['fnb', 'res', '12'].join(DIV),
    ['fnb', 'res', '34'].join(DIV),
    ['fnb', 'res', '56'].join(DIV)
  ]
  var wanted = [
    { type: 'put', key: keys[0], value: str(results[0]) },
    { type: 'put', key: keys[1], value: str(results[1]) },
    { type: 'put', key: keys[2], value: str(results[2]) },
    {
      type: 'put',
      key: ['fnb', 'trm', 'abc'].join(DIV),
      value: str([now].concat(keys))
    }
  ]
  var found = putOps('abc', results, now)
  t.plan(1)
  t.deepEqual(found, wanted)
  t.end()
})
