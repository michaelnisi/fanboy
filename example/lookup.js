const fanboy = require('../')

const cache = fanboy('/tmp/fanboy.db', {
  media: 'podcast'
})

const lookup = cache.lookup()
lookup.end('394775318')
lookup.pipe(process.stdout)
