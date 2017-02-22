const fanboy = require('../')

const cache = fanboy('/tmp/fanboy.db', {
  media: 'podcast'
})

const suggest = cache.suggest()
suggest.end('m')
suggest.pipe(process.stdout)
