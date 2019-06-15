#!/usr/bin/env node

// A REPL to explore the fanboy API, helpful for debugging:
// $ NODE_DEBUG=fanboy ./repl.js

const { Fanboy } = require('./')
const repl = require('repl')
const { inspect } = require('util')

const ctx = repl.start({
  prompt: 'fanboy> ',
  ignoreUndefined: true,
  input: process.stdin,
  output: process.stdout
}).context

const svc = new Fanboy('/tmp/fanboy-repl.db', {
  media: 'podcast',
  objectMode: true
})

function format (obj, prop) {
  return inspect(prop ? obj[prop] : obj, { colors: true })
}

// Needs to buffer, of course. This is not how you should be using streams.
function read (readable, prop) {
  let obj
  while ((obj = readable.read()) !== null) {
    console.log(format(obj, prop))
  }
}

const search = svc.search()
const suggest = svc.suggest()
const lookup = svc.lookup()

search.on('error', console.error)
suggest.on('error', console.error)
lookup.on('error', console.error)

ctx.search = search
ctx.suggest = suggest
ctx.lookup = lookup
ctx.read = read
