
// common - common test setup

module.exports.setup = setup
module.exports.teardown = teardown
module.exports.db = db
module.exports.opts = opts

var fs = require('fs')
  , levelup = require('levelup')
  , rimraf = require('rimraf')
  , path = require('path')
  ;

var _loc
function loc () {
  if (!_loc) _loc = '/tmp/fanboy-' + Math.floor(Math.random() * (1<<24))
  return _loc
}

var _db
function db () {
  if (!_db) _db = levelup(loc())
  return _db
}

function opts () {
  var opts = Object.create(null)
  opts.media = 'podcast'
  opts.db = db()
  opts.hostname = 'localhost'
  opts.port = 9999
  return opts
}

function setup (t) {
  t.plan(1)
  t.ok(process.env.NODE_TEST, 'should be defined')
  t.end()
}

function teardown (t) {
  t.plan(2)
  db().close()
  t.ok(db().isClosed(), 'should be closed')
  rimraf(loc(), function (er) {
    fs.stat(loc(), function (er) {
      t.ok(!!er, 'should be removed')
      t.end()
    })
  })
}
