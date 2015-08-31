var fanboy = require('../')

var cache = fanboy('/tmp/fanboy.db', {
  type: 'podcast'
})

var suggest = cache.suggest()
suggest.end('m')
suggest.pipe(process.stdout)
