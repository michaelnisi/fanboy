var common = require('./lib/common')
var nock = require('nock')
var test = require('tap').test

function codesBetween (smaller, larger) {
  var codes = []
  while (smaller < larger) {
    codes.push(smaller++)
  }
  return codes
}

function run (t, codes) {
  var code = codes.shift()
  if (!code) {
    return t.end()
  }
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
      run(t, codes)
    })
  })
  f.on('error', function (er) {
    t.pass('should error')
  })
  f.end('apple')
  f.resume()
}

test('1xx', { skip: false }, function (t) {
  var codes = codesBetween(100, 110)
  run(t, codes)
})

test('3xx', { skip: false }, function (t) {
  var codes = codesBetween(300, 310)
  run(t, codes)
})

test('4xx', { skip: false }, function (t) {
  var codes = codesBetween(400, 430)
  run(t, codes)
})

test('5xx', { skip: false }, function (t) {
  var codes = codesBetween(500, 510)
  run(t, codes)
})
