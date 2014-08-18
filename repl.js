#!/usr/bin/env node

// repl - dev repl

var levelup = require('levelup')
  , fanboy = require('./')
  , repl = require('repl')
  ;

var _opts
function opts () {
  return _opts || (_opts = {
    media: 'podcast'
  , db: levelup('/tmp/fanboy')
  , readableObjectMode: true
  })
}

process.on('uncaughtException', console.error)

repl.start({
  prompt: 'fanboy> '
, input: process.stdin
, output: process.stdout
}).context.fanboy = fanboy(opts())
