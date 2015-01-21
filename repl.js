#!/usr/bin/env node

// repl - explore fanboy

var fanboy = require('./')
var levelup = require('levelup')
var repl = require('repl')

var ctx = repl.start({
  prompt: 'fanboy> '
, input: process.stdin
, output: process.stdout
}).context

var svc = fanboy({
  media: 'podcast'
, db: levelup('/tmp/fanboy-repl')
, readableObjectMode: true
})

ctx.search = svc.search()
ctx.suggest = svc.suggest()
ctx.lookup = svc.lookup()
