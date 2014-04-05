
// repl - dev repl

var levelup = require('levelup')
  , db = levelup('/tmp/fanboy')
  , fanboy = require('./')
  , repl = require("repl")

function opts () {
  var opts = Object.create(null)
  opts.media = 'podcast'
  opts.db = db
  return opts
}

function lookup () {
  return fanboy.lookup(opts())
}

function search () {
  return fanboy.search(opts())
}

var context = {
  lookup: lookup
, search: search
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
