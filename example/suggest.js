
var opts = require('./opts')
var fanboy = require('../')

var suggest = fanboy(opts()).suggest()
suggest.end('m')
suggest.pipe(process.stdout)
