
var opts = require('./opts')
  , fanboy = require('../')
  ;

var search = fanboy.search(opts())
search.pipe(process.stdout)
search.write('merlin mann')
search.end()
