
var test = require('tap').test
  , common = require('./common')
  , fanboy = require('../')
  , keys = require('../lib/keys')
  , string_decoder = require('string_decoder')
  ;

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

var decoder = new string_decoder.StringDecoder('utf8')
function decode (buf) {
  return decoder.write(buf)
}

test('terms', function (t) {
  var db = common.db()
    , found = []
    ;
  db.batch(puts(), function (er) {
    t.ok(!er)
    var terms = fanboy.terms({ db:db })
    terms.on('readable', function () {
      var chunk
      while (null !== (chunk = terms.read())) {
        found.push(decode(chunk))
      }
    })
    terms.write('a')
    terms.write('ab')
    terms.write('abc')
    terms.write('abcd')
    terms.once('finish', function () {
      var wanted = [
        'abc'
      , 'abc'
      , 'abc'
      ]
      t.deepEqual(found, wanted)
      t.end()
    })
    terms.end()
  })
})

test('teardown', function (t) {
  common.teardown(t)
})
