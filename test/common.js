
// common - common test functions

exports.db = db
exports.opts = opts
exports.setup = setup
exports.teardown = teardown
exports.test = test

var fs = require('fs')
var http = require('http')
var levelup = require('levelup')
var path = require('path')
var querystring = require('querystring')
var rimraf = require('rimraf')
var routes = require('routes')
var url = require('url')
var util = require('util')

var _loc
function loc () {
  return _loc || (_loc = '/tmp/fanboy-' + Math.floor(
    Math.random() * (1<<24)))
}

var _db
function db () {
  return _db || (_db = levelup(loc()))
}

function opts (o) {
  var opts = {}
  util._extend(opts, o)
  opts.media = opts.media || 'podcast'
  opts.db = db()
  opts.hostname = opts.hostname || 'localhost'
  opts.port = opts.port || 9999
  opts.encoding = 'utf8'
  return opts
}

function setup (t) {
  t.plan(2)
  t.ok(process.env.NODE_TEST, 'should be defined')
  server(function (er) {
    t.ok(!er)
    t.end()
  })
}
function notfound(req, res) {
  res.writeHead(404)
  res.end('not found\n')
}

function st (req, res) {
  var p = path.join('./data', req.name) + '.json'
  fs.stat(p, function (er) {
    if (er) return notfound(req, res)
    res.writeHead(200)
    fs.createReadStream(p).pipe(res)
  })
}

function query (req) {
  return url.parse(req.url).query
}

function futile (req, res) {
  res.writeHead(200)
  res.write('{ "resultCount":3, "results":[')
  res.write('{ "collectionId":"abc", "feedUrl":"abc" },')
  res.end('{ "collectionId":"def", "feedUrl":"def" }')
}

function stutter (req, res) {
  res.writeHead(200)
  res.write('{ "resultCount":3, "results":[')
  res.write('{ "resultCount":3, "results":[')
  res.end()
}

function notjson (req, res) {
  res.writeHead(200)
  res.end('"hello"')
}

function forbidden (req, res) {
  res.writeHead(403)
  res.end()
}

var terms = {
  'futile':futile
, 'stutter':stutter
, 'notjson':notjson
, 'forbidden':forbidden
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
  var fn = rt ? rt.fn : null
  fn ? fn(req, res) : notfound(req, res)
}

function addRoute (path, fn) {
  router().addRoute(path, fn)
}

var _server
function server (cb) {
  if (!!_server) return _server
  addRoute('/lookup*', lookup)
  addRoute('/search*', search)
  return (_server = http.createServer(route).listen(9999, cb))
}

var _router
function router () {
  return _router || (_router = routes())
}

function empty (t, f) {
  t.plan(1)
  var found
  var wanted = '[]\n'
  f.on('readable', function () {
    found = f.read()
  })
  f.on('end', function () {
    t.is(found, wanted)
    t.end()
  })
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
    empty(t, f)
    f.end('notjson')
  }
, 'forbidden': function (t, f) {
    empty(t, f)
    f.end('forbidden')
  }
, 'surprise': function (t, f) {
    empty(t, f)
    f.end('surprise')
  }
, 'ECONNREFUSED': function (t, f) {
    t.plan(1)
    f.on('error', function (er) {
      t.ok(er, 'should error')
      t.end()
    })
    f.end('abc')
  }
, 'futile': function (t, f) {
    var buf = ''
    f.on('readable', function () {
      var chunk
      while (null !== (chunk = f.read())) {
        buf += chunk
      }
    })
    f.end('futile', function () {
      var results = JSON.parse(buf)
      t.plan(2)
      results.map(function (result) {
        t.ok(result.guid)
      })
      t.end()
    })
  }
, 'lie': function (t, f) {
    empty(t, f)
    f.end('lie')
  }
, 'stutter': function (t, f) {
    empty(t, f)
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
  server().close(function (er) {
    t.ok(!er)
    rimraf(loc(), function (er) {
      fs.stat(loc(), function (er) {
        t.ok(!!er, 'should be removed')
        t.end()
      })
    })
  })
}
