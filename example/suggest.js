
var opts = require('./opts')
  , fanboy = require('../')
  ;

var suggest = fanboy.suggest(opts())
suggest.end('mer')
suggest.pipe(process.stdout)
