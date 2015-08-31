var common = require('./lib/common')
var nock = require('nock')
var test = require('tap').test

function testCode (t) {
  return function (code) {
    var scope = nock('http://itunes.apple.com')
      .get('/search?media=podcast&country=us&term=apple')
      .reply(code)
    var cache = common.freshCache()
    var f = cache.search()
    var buf = ''
    f.on('data', function (chunk) {
      buf += chunk
    })
    f.on('end', function (er) {
      var wanted = []
      var found = JSON.parse(buf)
      t.same(wanted, found)
      t.ok(scope.isDone())
      common.teardown(cache, function () {
        t.pass('should teardown')
      })
    })
    f.on('error', function (er) {
      t.pass('should error')
    })
    f.end('apple')
    f.resume()
  }
}

test('1xx', { skip: false }, function (t) {
  var codes = []
  var sc = 100
  while (sc < 110) {
    codes.push(sc++)
  }
  t.plan(4 * codes.length)
  codes.forEach(testCode(t))
})

test('3xx', { skip: false}, function (t) {
  var codes = []
  var sc = 300
  while (sc < 310) {
    codes.push(sc++)
  }
  t.plan(4 * codes.length)
  codes.forEach(testCode(t))
})

test('4xx', function (t) {
  var codes = []
  var sc = 400
  while (sc < 430) {
    codes.push(sc++)
  }
  t.plan(4 * codes.length)
  codes.forEach(testCode(t))
})

test('5xx', function (t) {
  var codes = []
  var sc = 500
  while (sc < 510) {
    codes.push(sc++)
  }
  t.plan(4 * codes.length)
  codes.forEach(testCode(t))
})
