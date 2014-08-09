
var common = require('./common')
  , fanboy = require('../')
  , test = require('tap').test
  ;

var _server
function server () {
  return _server || (_server = common.server())
}

test('setup', function (t) {
  common.setup(t)
  server()
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

test('uninterrupted', function (t) {
  common.test(t, fanboy.search(opts()))
})

test('interrupted', function (t) {
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

test('teardown', function (t) {
  server().close(function () {
    common.teardown(t)
  })
})
