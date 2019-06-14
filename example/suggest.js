const { Fanboy } = require('../')

const cache = new Fanboy('/tmp/fanboy.db', {
  media: 'podcast'
})

const suggest = cache.suggest()

suggest.end('i')
suggest.pipe(process.stdout)
