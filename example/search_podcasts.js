
var fanboy = require('../')

function PodcastResult (guid, title, author) {
  this.guid = guid
  this.title = title
  this.author = author
}

function reduce (result) {
  return new PodcastResult(
    result.collectionId
  , result.collectionName
  , result.artistName
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
