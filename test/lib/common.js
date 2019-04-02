'use-strict'

exports.freshCache = freshCache
exports.teardown = teardown

const fanboy = require('../../')
const rimraf = require('rimraf')

function freshCache (highWaterMark, hostname, port) {
  const name = '/tmp/fanboy-' + Math.floor(Math.random() * (1 << 24))
  const opts = {
    highWaterMark: highWaterMark || Math.round(Math.random() * 16),
    hostname: hostname,
    media: 'podcast',
    port: port
  }
  return fanboy(name, opts)
}

function teardown (cache, cb) {
  const db = cache.db
  db.close((er) => {
    if (er) throw er
    const name = db.location
    rimraf(name, (er) => {
      if (er) throw er
      cb()
    })
  })
}
