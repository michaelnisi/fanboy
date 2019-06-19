'use-strict'

exports.freshCache = freshCache
exports.teardown = teardown

const { Fanboy, createLevelDB } = require('../../')
const rimraf = require('rimraf')
const { defaults } = require('../../lib/init')

function freshCache (custom = { media: 'podcast' }) {
  const location = '/tmp/fanboy-' + Math.floor(Math.random() * (1 << 24))
  const opts = defaults(custom)
  const db = createLevelDB(location)

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
