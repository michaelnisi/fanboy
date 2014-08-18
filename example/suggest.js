
var opts = require('./opts')
  , fanboy = require('../')
  ;

var suggest = fanboy(opts()).suggest()
suggest.end('mer')
suggest.pipe(process.stdout)
