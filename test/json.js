'use strict'

var fs = require('fs')
var { createResultsParser } = require('../lib/json')
var path = require('path')
var stread = require('stread')
var test = require('tap').test

test('basics', { skip: false }, function (t) {
  t.plan(51)
  var file = path.resolve(__dirname, 'data', 'apple.json')
  var readable = fs.createReadStream(file)
  var props = [
    'artistName', 'trackName', 'kind'
  ]
  function some () {
    return props[Math.floor(Math.random() * props.length)]
  }
  var s = createResultsParser(readable)
  s.on('data', function (obj) {
    t.ok(obj[some()], 'should have some')
    if (Math.random() > 0.5) {
      s.pause()
      setTimeout(function () {
        s.resume()
      }, 100)
    }
  })
  s.on('end', function () {
    t.pass('should end')
  })
})

test('not json', { skip: false }, function (t) {
  var readable = stread('why hello')
  var s = createResultsParser(readable)
  t.plan(2)
  s.on('error', function (er) {
    t.ok(er)
  })
  s.on('data', function (obj) {
    t.fail('should not emit data')
  })
  s.on('end', function () {
    t.pass('should end')
  })
})
