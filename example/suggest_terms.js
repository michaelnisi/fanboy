
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

var suggest = fanboy.suggest(opts())
suggest.pipe(process.stdout)
suggest.write('mer')
suggest.end()
