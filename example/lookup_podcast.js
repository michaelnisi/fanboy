
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

var lookup = fanboy.lookup(opts())
lookup.pipe(process.stdout)
lookup.write('471418144')
lookup.end()
