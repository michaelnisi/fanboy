
// common - common test functions

exports.db = db
exports.opts = opts
exports.server = server
exports.setup = setup
exports.teardown = teardown
exports.test = test

var fs = require('fs')
  , http = require('http')
  , levelup = require('levelup')
  , path = require('path')
  , querystring = require('querystring')
  , rimraf = require('rimraf')
  , routes = require('routes')
  , util = require('util')
  , url = require('url')
  ;

function notfound(req, res) {
  res.writeHead(404)
  res.end('not found\n')
}

function st (req, res) {
  var p = path.join('./data', req.name) + '.json'
  fs.stat(p, function (er) {
    er ?
    notfound(req, res) :
    fs.createReadStream(p).pipe(res)
  })
}

function query (req) {
  return url.parse(req.url).query
}

function uninterrupted (req, res) {
  res.write('{ "resultCount":3, "results":[')
  res.write('{ "collectionId":"abc", "feedUrl":"abc" },')
  res.write('{ "collectionId":"def", "feedUrl":"def" }')
  res.end(']}')
}

function interrupted (req, res) {
  res.write('{ "resultCount":3, "results":[')
  res.write('{ "collectionId":"abc", "feedUrl":"abc" },')
  res.end('{ "collectionId":"def", "feedUrl":"def" }')
}

function stutter (req, res) {
  res.write('{ "resultCount":3, "results":[')
  res.write('{ "resultCount":3, "results":[')
  res.end()
}

var terms = {
  'interrupted':interrupted
, 'uninterrupted':uninterrupted
, 'stutter':stutter
}

function search (req, res) {
  req.name = req.name || querystring.parse(query(req)).term
  var f = terms[req.name] || st
  f(req, res)
}

function lookup (req, res) {
  req.name = querystring.parse(query(req)).id
  search(req, res)
}

function route (req, res) {
  var rt = router().match(req.url)
    , fn = rt ? rt.fn : null
    ;
  fn ? fn(req, res) : notfound(req, res)
}

function addRoute (path, fn) {
  router().addRoute(path, fn)
}

function server () {
  addRoute('/lookup*', lookup)
  addRoute('/search*', search)
  return http.createServer(route).listen(opts().port)
}

var _router
function router () {
  return _router || (_router = routes())
}

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

function opts (o) {
  var opts = {}
  util._extend(opts, o)
  opts.media = opts.media || 'podcast'
  opts.db = db()
  opts.hostname = opts.hostname || 'localhost'
  opts.port = opts.port || 9999
  return opts
}

function setup (t) {
  t.plan(1)
  t.ok(process.env.NODE_TEST, 'should be defined')
  t.end()
}

var _tests = {
  'ENOTFOUND': function (t, f) {
    t.plan(1)
    f.on('error', function (er) {
      t.ok(er, 'should error')
      t.end()
    })
    f.end('abc')
  }
, 'ENOTJSON': function (t, f) {
    f.on('error', function (er) {
      t.is(er.message, 'Unexpected "o" at position 1 in state NULL1')
      t.end()
    })
    f.end('abc')
  }
, 'surprise': function (t, f) {
    f.on('error', function (er) {
      t.is(er.message, 'JSON contained no results')
      t.end()
    })
    f.write('surprise')
    f.end()
  }
, 'ECONNREFUSED': function (t, f) {
    t.plan(1)
    f.on('error', function (er) {
      t.ok(er, 'should error')
      t.end()
    })
    f.end('abc')
  }
, 'uninterrupted': function (t, f) {
    t.plan(1)
    f.end('uninterrupted', function () {
      t.ok(true)
      t.end()
    })
  }
, 'interrupted': function (t, f) {
    var buf = ''
      ;
    f.on('readable', function () {
      var chunk
      while (null !== (chunk = f.read())) {
        buf += chunk
      }
    })
    f.end('interrupted', function () {
      var results = JSON.parse(buf)
      t.plan(2)
      results.map(function (result) {
        t.ok(result.guid)
      })
      t.end()
    })
  }
, 'lie': function (t, f) {
    f.on('error', function (er) {
      t.is(er.message, 'JSON contained no results')
      t.end()
    })
    f.write('lie')
    f.end()
  }
, 'stutter': function (t, f) {
    t.plan(1)
    f.on('error', function (er) {
      t.is(er.message, 'no results')
      t.end()
    })
    f.end('stutter')
  }
}

function test (t, f) {
  _tests[t.conf.name](t, f)
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
