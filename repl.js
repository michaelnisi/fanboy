#!/usr/bin/env node

// repl - dev REPL

var fanboy = require('./')
  , levelup = require('levelup')
  , repl = require('repl')
  ;

process.on('uncaughtException', console.error)

repl.start({
  prompt: 'fanboy> '
, input: process.stdin
, output: process.stdout
}).context.fanboy = fanboy({
  media: 'podcast'
, db: levelup('/tmp/fanboy')
, readableObjectMode: true
})
