#!/usr/bin/env node

// A REPL to explore the fanboy API, helpful for debugging:
// $ NODE_DEBUG=fanboy ./repl.js

const { Fanboy, createLevelDB } = require('./')
const repl = require('repl')
const { inspect } = require('util')
const { Transform, pipeline } = require('stream')

function createCache () {
  const location = '/tmp/fanboy-repl'
  const db = createLevelDB(location)

  return new Fanboy(db)
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

const writer = new Transform({
  transform (obj, enc, cb) {
    const [item, prop] = obj

    if (item) {
      const chunk = format(item, prop)

      this.push(chunk)
      this.push('\n')
    } else {
      this.push(null)
    }

    cb()
  },
  objectMode: true
})

pipeline(
  writer,
  process.stdout,
  err => {
    console.error(err || new Error('pipeline ended'))
  }
)

function print (error, items, prop) {
  if (error) {
    return console.error(error)
  }

  process.stdout.write('\n')

  for (let item of items) {
    writer.write([item, prop])
  }

  process.stdout.write('ok\n')
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
