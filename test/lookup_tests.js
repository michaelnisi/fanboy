
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

function opts () {
  return common.opts()
}

test('lie', function (t) {
  common.test(t, fanboy.lookup(opts()))
})

test('surprise', function (t) {
  common.test(t, fanboy.lookup(opts()))
})

test('ENOTJSON', function (t) {
  common.test(t, fanboy.lookup(opts()))
})

test('ENOTFOUND', function (t) {
  common.test(t, fanboy.lookup(opts({ hostname:'nasty'})))
})

test('ECONNREFUSED', function (t) {
  common.test(t, fanboy.lookup(opts({port:9998})))
})

test('uninterrupted', function (t) {
  common.test(t, fanboy.lookup(opts()))
})

test('interrupted', function (t) {
  common.test(t, fanboy.lookup(opts()))
})

test('stutter', function (t) {
  common.test(t, fanboy.lookup(opts()))
})

test('simple', function (t) {
  var f = fanboy.lookup(opts())
  f.write('537879700')
  f.end()
  var buf = ''
  f.on('readable', function () {
    var chunk
    while (null !== (chunk = f.read())) {
      buf += chunk
    }
  })
  t.plan(2)
  f.on('finish', function () {
    var items = JSON.parse(buf)
    t.is(items.length, 1)
    var found = items[0]
    function wanted () {
      return { author: 'Tim Pritlove',
        feed: 'http://feeds.feedburner.com/forum-politische-bildung',
        guid: 537879700,
        img100: 'http://a5.mzstatic.com/us/r30/Podcasts6/v4/00/49/fc/0049fc95-1329-4643-ad93-3baf54d8a928/mza_2273418040917995716.100x100-75.jpg',
        img30: 'http://a4.mzstatic.com/us/r30/Podcasts6/v4/00/49/fc/0049fc95-1329-4643-ad93-3baf54d8a928/mza_2273418040917995716.30x30-50.jpg',
        img60: 'http://a1.mzstatic.com/us/r30/Podcasts6/v4/00/49/fc/0049fc95-1329-4643-ad93-3baf54d8a928/mza_2273418040917995716.60x60-50.jpg',
        img600: 'http://a1.mzstatic.com/us/r30/Podcasts6/v4/00/49/fc/0049fc95-1329-4643-ad93-3baf54d8a928/mza_2273418040917995716.600x600-75.jpg',
        title: 'Seminargespräche',
        updated: 1389090240000 }
    }
    t.deepEqual(found, wanted())
    t.end()
  })
})

test('teardown', function (t) {
  server().close(function () {
    common.teardown(t)
  })
})
