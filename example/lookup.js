var fanboy = require('../')

var cache = fanboy('/tmp/fanboy.db', {
  type: 'podcast'
})

var lookup = cache.lookup()
lookup.end('471418144')
lookup.pipe(process.stdout)
