
var opts = require('./opts')
  , fanboy = require('../')
  ;

var lookup = fanboy.lookup(opts())
lookup.end('471418144')
lookup.pipe(process.stdout)
