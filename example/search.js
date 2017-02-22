const fanboy = require('../')

const cache = fanboy('/tmp/fanboy.db', {
  media: 'podcast'
})

const search = cache.search()
search.end('invisible')
search.pipe(process.stdout)
