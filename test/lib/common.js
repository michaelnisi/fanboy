exports.teardown = teardown
exports.freshCache = freshCache

var fanboy = require('../../')
var rimraf = require('rimraf')

function freshCache (highWaterMark) {
  var name = '/tmp/fanboy-' + Math.floor(Math.random() * (1 << 24))
  var opts = {
    highWaterMark: highWaterMark || Math.round(Math.random() * 16),
    media: 'podcast'
  }
  var cache = fanboy(name, opts)
  return cache
}

function teardown (cache, cb) {
  var db = cache.db
  db.close(function (er) {
    if (er) throw er
    var name = db.location
    rimraf(name, function (er) {
      if (er) throw er
      cb()
    })
  })
}
