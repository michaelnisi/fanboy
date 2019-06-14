const { Fanboy } = require('../')

const cache = new Fanboy('/tmp/fanboy.db', {
  media: 'podcast'
})

const search = cache.search()

search.end('invisible')
search.pipe(process.stdout)
