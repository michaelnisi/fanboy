#!/usr/bin/env node

// A REPL to explore the fanboy API, helpful for debugging:
// $ NODE_DEBUG=fanboy ./repl.js

const { Fanboy } = require('./')
const repl = require('repl')
const { inspect } = require('util')
const { createDatabase } = require('./lib/level')
const { defaults } = require('./lib/init')

function createCache (custom = { media: 'podcast' }) {
  const location = '/tmp/fanboy-repl'
  const opts = defaults(custom)
  const db = createDatabase(location)

  return new Fanboy(db, opts)
}

const fanboy = createCache()

const server = repl.start({
  prompt: 'fanboy> ',
  ignoreUndefined: true,
  input: process.stdin,
  output: process.stdout
})

const { context } = server

function format (obj, prop) {
  return inspect(prop ? obj[prop] : obj, { colors: true })
}

function print (error, items, prop) {
  if (error) {
    return console.error(error)
  }

  for (let item of items) {
    console.log(format(item, prop))
  }

  server.displayPrompt()
}

function search (term, prop) {
  fanboy.search(term, (error, items) => {
    print(error, items, prop)
  })
}

function lookup (guid, prop) {
  fanboy.lookup(guid, (error, item) => {
    print(error, [item], prop)
  })
}

function suggest (term) {
  fanboy.suggest(term, (error, terms) => {
    print(error, terms)
  })
}

context.search = search
context.lookup = lookup
context.suggest = suggest
