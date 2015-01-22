
var common = require('./lib/common')
var fanboy = require('../')
var keys = require('../lib/keys')
var string_decoder = require('string_decoder')
var test = require('tap').test

var _decoder = new string_decoder.StringDecoder('utf8')
function decode (buf) {
  return _decoder.write(buf)
}

test('setup', function (t) {
  common.setup(t)
})

function key (term) {
  return keys.key(keys.TRM, term)
}

function terms () {
  return ['abc', 'def', 'ghi']
}

function put (term) {
  return { type:'put', key:key(term), value:term.toUpperCase() }
}

function puts () {
  var puts = []
  terms().forEach(function (term) {
    puts.push(put(term))
  })
  return puts
}

test('no results', function (t) {
  var f = fanboy.suggest(common.opts())
  var buf = ''
  f.on('data', function (chunk) {
    buf += chunk
  })
  f.on('end', function () {
    var found = JSON.parse(decode(buf))
    var wanted = []
    t.deepEqual(found, wanted)
    t.end()
  })
  f.end('xoxoxo')
})

test('suggest', function (t) {
  var opts = common.opts()
  var db = opts.db
  db.batch(puts(), function (er) {
    t.ok(!er)
    var buf = ''
    var f = fanboy.suggest(opts)
    f.on('readable', function () {
      var chunk
      while (null !== (chunk = f.read())) {
        buf += chunk
      }
    })
    f.write('a')
    f.write('ab')
    f.write('abc')
    f.end('abcd')
    f.on('end', function () {
      var found = JSON.parse(decode(buf))
      var wanted = ['abc', 'abc', 'abc']
      t.deepEqual(found, wanted)
      t.end()
    })
  })
})

test('teardown', function (t) {
  common.teardown(t)
})
