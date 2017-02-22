var fanboy = require('../')

var cache = fanboy('/tmp/fanboy.db', {
  media: 'podcast'
})

var search = cache.search()
search.end('merlin mann')
search.pipe(process.stdout)
