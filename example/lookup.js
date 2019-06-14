const { Fanboy } = require('../')

const cache = new Fanboy('/tmp/fanboy.db', {
  media: 'podcast'
})

const lookup = cache.lookup()

lookup.end('394775318')
lookup.pipe(process.stdout)
