
var test = require('tap').test
var common = require('./common')
var fanboy = require('../')
var keys = require('../lib/keys')
var string_decoder = require('string_decoder')

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
  t.plan(1)
  var db = common.db()
  var found = []
  var f = fanboy.suggest({ db:db })
  f.on('error', function (er) {
    t.is(er.message, 'no results')
    t.end()
  })
  f.end('xoxoxo')
})

test('suggest', function (t) {
  var db = common.db()
    , found = []
    ;
  db.batch(puts(), function (er) {
    t.ok(!er)
    var f = fanboy.suggest({ db:db })
    f.on('error', function (er) {
      t.is(er.message, 'no results')
    })
    f.on('readable', function () {
      var chunk
      while (null !== (chunk = f.read())) {
        found.push(decode(chunk))
      }
    })
    f.write('a')
    f.write('ab')
    f.write('abc')
    f.write('abcd')
    f.once('finish', function () {
      var wanted = [
        '["abc"'
      , ',"abc"'
      , ',"abc"'
      , ']\n'
      ]
      t.deepEqual(found, wanted)
      t.end()
    })
    f.end()
  })
})

test('teardown', function (t) {
  common.teardown(t)
})
