'use strict'

var common = require('./lib/common')
var fs = require('fs')
var nock = require('nock')
var path = require('path')
var test = require('tap').test

test('invalid guid', function (t) {
  t.plan(2)
  var cache = common.freshCache()
  var f = cache.lookup()
  f.on('error', function (er) {
    t.is(er.message, 'fanboy: guid x is not a number')
  })
  f.on('end', function () {
    t.pass('should end')
  })
  f.write('x')
  f.end()
  f.resume()
})

test('simple', function (t) {
  t.plan(4)
  var scope = nock('http://itunes.apple.com')
    .get('/lookup?id=537879700')
    .reply(200, function (uri, body) {
      t.comment(uri)
      var p = path.join(__dirname, 'data', '537879700.json')
      return fs.createReadStream(p)
    })
  var cache = common.freshCache()
  var f = cache.lookup()
  f.write('537879700')
  f.end()
  var buf = ''
  f.on('data', function (chunk) {
    buf += chunk
  })
  f.on('end', function () {
    var items = JSON.parse(buf)
    t.is(items.length, 1)
    var found = items[0]
    var wanted = {
      author: 'Tim Pritlove',
      feed: 'http://feeds.feedburner.com/forum-politische-bildung',
      guid: 537879700,
      img100: 'http://a5.mzstatic.com/us/r30/Podcasts6/v4/00/49/fc/0049fc95-1329-4643-ad93-3baf54d8a928/mza_2273418040917995716.100x100-75.jpg',
      img30: 'http://a4.mzstatic.com/us/r30/Podcasts6/v4/00/49/fc/0049fc95-1329-4643-ad93-3baf54d8a928/mza_2273418040917995716.30x30-50.jpg',
      img60: 'http://a1.mzstatic.com/us/r30/Podcasts6/v4/00/49/fc/0049fc95-1329-4643-ad93-3baf54d8a928/mza_2273418040917995716.60x60-50.jpg',
      img600: 'http://a1.mzstatic.com/us/r30/Podcasts6/v4/00/49/fc/0049fc95-1329-4643-ad93-3baf54d8a928/mza_2273418040917995716.600x600-75.jpg',
      title: 'Seminargespräche',
      updated: 1389090240000
    }
    t.same(found, wanted)
    t.ok(scope.isDone())
    common.teardown(cache, function () {
      t.pass('should teardown')
    })
  })
})
