
var opts = require('./opts')
  , fanboy = require('../')
  ;

var suggest = fanboy.suggest(opts())
suggest.pipe(process.stdout)
suggest.write('mer')
suggest.end()
