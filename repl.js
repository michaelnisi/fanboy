#!/usr/bin/env node

// repl - explore fanboy

var fanboy = require('./')
var levelup = require('levelup')
var repl = require('repl')
var util = require('util')

var ctx = repl.start({
  prompt: 'fanboy> '
, ignoreUndefined: true
, input: process.stdin
, output: process.stdout
}).context

var svc = fanboy({
  media: 'podcast'
, db: levelup('/tmp/fanboy-repl')
, readableObjectMode: true
})

function read (stream, prop) {
  var obj
  while (null !== (obj = stream.read())) {
    console.log(
      util.inspect(
        !!prop ? obj[prop] : obj
      , { colors: true }))
  }
}

var search = svc.search()
var suggest = svc.suggest()
var lookup = svc.lookup()

search.on('error', console.error)
suggest.on('error', console.error)
lookup.on('error', console.error)

ctx.search = search
ctx.suggest = suggest
ctx.lookup = lookup
ctx.read = read
