
var fanboy = require('../')
  , levelup = require('levelup')
  , assert = require('assert')
  , bunyan = require('bunyan')
  , reduce = require('./reduce').reduce
  , Result = require('./reduce').Result

function loc () {
  return '/tmp/fanboy'
}

function log () {
  return bunyan.createLogger({
    name: 'fanboy'
  , streams: [{
      level: 'error',
      path: '/tmp/fanboy.log'
    }]
  })
}

function opts (db) {
  var opts = Object.create(null)
  opts.media = 'podcast'
  opts.reduce = reduce
  opts.db = db
  opts.log = log()
  return opts
}

function term () {
  return process.argv.splice(2)[0] || '*'
}

function start (er, db) {
  assert(!er, er)
  var lookup = fanboy.lookup(opts(db))
  lookup.write('537879700', 'utf8')
  lookup.write('537879700', 'utf8')
  lookup.pipe(process.stdout)
  lookup.end()
}

levelup(loc(), null, start)
