
var opts = require('./opts')
  , fanboy = require('../')
  ;

var search = fanboy.search(opts())
search.end('merlin mann')
search.pipe(process.stdout)
