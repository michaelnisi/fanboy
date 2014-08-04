#!/usr/bin/env node

// repl - dev repl

var levelup = require('levelup')
  , fanboy = require('./')
  , repl = require('repl')
  ;

var _opts
function opts () {
  if (!_opts) {
    _opts = Object.create(null)
    _opts.media = 'podcast'
    _opts.db = levelup('/tmp/fanboy')
    _opts.readableObjectMode = true
  }
  return _opts
}

function lookup () {
  return fanboy.lookup(opts())
}

function search () {
  return fanboy.search(opts())
}

function suggest () {
  return fanboy.suggest(opts())
}

var context = {
  lookup: lookup
, search: search
, suggest: suggest
}

var desc = Object.getOwnPropertyNames(context).map(function (n) {
  return [n, Object.getOwnPropertyDescriptor(context, n)]
}).reduce(function (set, kv) {
  set[kv[0]] = kv[1]
  return set
}, {})

var r = repl.start({
  prompt: 'fanboy> '
, input: process.stdin
, output: process.stdout
})

Object.defineProperties(r.context, desc)
