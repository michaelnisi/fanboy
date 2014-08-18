
var opts = require('./opts')
  , fanboy = require('../')
  ;

var search = fanboy(opts()).search()
search.end('merlin mann')
search.pipe(process.stdout)
