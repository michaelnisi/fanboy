'use strict'

var common = require('./lib/common')
var keys = require('../lib/keys')
var StringDecoder = require('string_decoder').StringDecoder
var test = require('tap').test

var decoder = new StringDecoder('utf8')

function decode (buf) {
  return decoder.write(buf)
}

function key (term) {
  return keys.key(keys.TRM, term)
}

function terms () {
  return ['abc', 'def', 'ghi']
}

function put (term) {
  return { type: 'put', key: key(term), value: term.toUpperCase() }
}

function puts () {
  var puts = []
  terms().forEach(function (term) {
    puts.push(put(term))
  })
  return puts
}

test('no results', function (t) {
  t.plan(2)
  var cache = common.freshCache()
  var f = cache.suggest()
  var buf = ''
  f.on('data', function (chunk) {
    buf += chunk
  })
  f.on('end', function () {
    var found = JSON.parse(decode(buf))
    var wanted = []
    t.deepEqual(found, wanted)
    common.teardown(cache, function () {
      t.pass('should teardown')
    })
  })
  f.end('xoxoxo')
})

test('suggest', function (t) {
  var cache = common.freshCache()
  var db = cache.db
  t.plan(3)
  db.batch(puts(), function (er) {
    t.ok(!er)
    var buf = ''
    var f = cache.suggest()
    f.on('readable', function () {
      var chunk
      while ((chunk = f.read()) !== null) {
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
      common.teardown(cache, function () {
        t.pass('should teardown')
      })
    })
  })
})
