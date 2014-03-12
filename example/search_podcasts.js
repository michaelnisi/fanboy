
// node example/search_podcasts.js mule | json -a title

var fanboy = require('../')
  , levelup = require('levelup')
  , assert = require('assert')
  , bunyan = require('bunyan')

function loc () {
  return '/tmp/fanboy'
}

function Result (
  author
, feed
, guid
, img100
, img30
, img60
, img600
, title
, updated) {
  this.author = author
  this.feed = feed
  this.guid = guid
  this.img100 = img100
  this.img30 = img30
  this.img60 = img60
  this.img600 = img600
  this.title = title
  this.updated = updated
}

function reduce (result) {
  return new Result(
    result.artistName
  , result.feedUrl
  , result.collectionId
  , result.artworkUrl100
  , result.artworkUrl30
  , result.artworkUrl60
  , result.artworkUrl600
  , result.collectionName
  , new Date(result.releaseDate).getTime()
  )
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
  var opts = fanboy.opts()
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
  var search = fanboy.search(opts(db))
  search.write(term(), 'utf8')
  search.pipe(process.stdout)
  search.end()
}

levelup(loc(), null, start)
