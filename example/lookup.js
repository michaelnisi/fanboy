var fanboy = require('../')

var cache = fanboy('/tmp/fanboy.db', {
  media: 'podcast'
})

var lookup = cache.lookup()
lookup.end('471418144')
lookup.pipe(process.stdout)
