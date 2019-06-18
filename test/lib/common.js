'use-strict'

exports.freshCache = freshCache
exports.teardown = teardown

const { Fanboy } = require('../../')
const rimraf = require('rimraf')
const { createDatabase } = require('../../lib/level')
const { defaults } = require('../../lib/init')

function freshCache (custom = { media: 'podcast' }) {
  const location = '/tmp/fanboy-' + Math.floor(Math.random() * (1 << 24))
  const opts = defaults(custom)
  const db = createDatabase(location, opts.cacheSize)

  return new Fanboy(db, opts)
}

function teardown (cache, cb) {
  const { db } = cache

  db.close((er) => {
    if (er) throw er

    const { _db: { db: { location } } } = db

    rimraf(location, (er) => {
      if (er) throw er
      cb()
    })
  })
}
