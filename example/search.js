var fanboy = require('../')

var cache = fanboy('/tmp/fanboy.db', {
  type: 'podcast'
})

var search = cache.search()
search.end('merlin mann')
search.pipe(process.stdout)
