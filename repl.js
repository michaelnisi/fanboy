#!/usr/bin/env node

// repl - just a little REPL to play

var fanboy = require('./')
var levelup = require('levelup')
var repl = require('repl')

process.on('uncaughtException', console.error)

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
