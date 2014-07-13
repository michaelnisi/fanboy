
var opts = require('./opts')
  , fanboy = require('../')
  ;

var lookup = fanboy.lookup(opts())
lookup.pipe(process.stdout)
lookup.write('471418144')
lookup.end()
