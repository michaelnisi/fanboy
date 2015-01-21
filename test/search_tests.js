
var common = require('./common')
var fanboy = require('../')
var test = require('tap').test

test('setup', function (t) {
  common.setup(t)
})

function opts (o) {
  return common.opts(o)
}

test('lie', function (t) {
  common.test(t, fanboy.search(opts()))
})

test('surprise', function (t) {
  common.test(t, fanboy.search(opts()))
})

test('ENOTJSON', function (t) {
  common.test(t, fanboy.search(opts()))
})

test('ENOTFOUND', function (t) {
  common.test(t, fanboy.search(opts({hostname:'nasty'})))
})

test('ECONNREFUSED', function (t) {
  common.test(t, fanboy.search(opts({port:9998})))
})

test('futile', function (t) {
  common.test(t, fanboy.search(opts()))
})

test('forbidden', function (t) {
  common.test(t, fanboy.search(opts()))
})

test('stutter', function (t) {
  common.test(t, fanboy.search(opts()))
})

test('simple', function (t) {
  var f = fanboy.search(opts())
  var buf = ''
  f.write('gruber')
  f.write('gruber')
  f.end()
  f.on('readable', function () {
    var chunk
    while (null !== (chunk = f.read())) {
      buf += chunk
    }
  })
  t.plan(1)
  f.on('finish', function () {
    var items = JSON.parse(buf)
    t.is(items.length, 13 * 2)
    t.end()
  })
})

test('not found', function (t) {
  t.plan(2)
  var f = fanboy.search(opts())
  f.keysForTerm('abc', function (er, keys) {
    t.ok(er.notFound, 'should error not found')
    t.is(keys, undefined)
    t.end()
  })
})

test('no results', function (t) {
  var db = common.db()
  var found = []
  var f = fanboy.search({ db:db })
  f.on('end', function (er) {
    t.end()
  })
  f.end('xoxoxo')
  f.resume()
})

test('teardown', function (t) {
  common.teardown(t)
})
