
var levelup = require('levelup')
  , db = levelup('/tmp/fanboy')
  , fanboy = require('../')
  ;

function opts () {
  var opts = Object.create(null)
  opts.media = 'podcast'
  opts.db = db
  return opts
}

var search = fanboy.search(opts())
search.pipe(process.stdout)
search.write('merlin mann')
search.end()
