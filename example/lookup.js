
var opts = require('./opts')
  , fanboy = require('../')
  ;

var lookup = fanboy(opts()).lookup()
lookup.end('471418144')
lookup.pipe(process.stdout)
