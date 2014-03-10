
var fanboy = require('../')

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
  , result.releaseDate
  )
}

function opts () {
  var opts = fanboy.SearchOpts('podcast')
  opts.reduce = reduce
  return opts
}

function term () {
  return process.argv.splice(2)[0] || '*'
}

var search = fanboy.Search(opts())
search.write(term(), 'utf8')
search.pipe(process.stdout)
search.end()
