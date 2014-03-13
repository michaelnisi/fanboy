
// node example/search_podcasts.js mule | json -a title

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

function opts () {
  var opts = fanboy.opts()
  opts.media = 'podcast'
  opts.reduce = reduce
  return opts
}

function term () {
  return process.argv.splice(2)[0] || '*'
}

function start (er, db) {
  assert(!er, er)
  var search = fanboy.search(db, log(), opts())
  search.write(term(), 'utf8')
  search.pipe(process.stdout)
  search.end()
}

levelup(loc(), null, start)
