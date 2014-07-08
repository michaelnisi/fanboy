
var common = require('./common')
  , fanboy = require('../')
  , fs = require('fs')
  , http = require('http')
  , path = require('path')
  , querystring = require('querystring')
  , router = require('routes')
  , test = require('tap').test
  , url = require('url')
  ;

function lookup (req, res) {
  var p = path.join('./data', req.query.id) + '.json'
  fs.createReadStream(p).pipe(res)
}

function decorate (req) {
  var query = url.parse(req.url).query
  req.query = querystring.parse(query)
  return req
}

function route (req, res) {
  var rt = routes().match(req.url)
    , fn = rt ? rt.fn : null
    ;
  if (fn) {
    fn(decorate(req), res)
  } else {
    res.writeHead(404)
    res.end('not found\n')
  }
}

var _server
function server () {
  if (!_server) {
    _server = http.createServer(route).listen(opts().port)
  }
  return _server
}

var _routes
function routes () {
  if (!_routes) _routes = router()
  return _routes
}

test('setup', function (t) {
  routes().addRoute('/lookup*', lookup)
  server()
  common.setup(t)
})

function opts () {
  return common.opts()
}

test('simple', function (t) {
  var f = fanboy.lookup(opts())
  f.write('537879700')
  f.end()
  var buf = ''
  f.on('readable', function () {
    var chunk
    while (null !== (chunk = f.read())) {
      buf += chunk
    }
  })
  t.plan(2)
  f.on('finish', function () {
    var items = JSON.parse(buf)
    t.is(items.length, 1)
    var found = items[0]
    function wanted () {
      return { author: 'Tim Pritlove',
        feed: 'http://feeds.feedburner.com/forum-politische-bildung',
        guid: 537879700,
        img100: 'http://a5.mzstatic.com/us/r30/Podcasts6/v4/00/49/fc/0049fc95-1329-4643-ad93-3baf54d8a928/mza_2273418040917995716.100x100-75.jpg',
        img30: 'http://a4.mzstatic.com/us/r30/Podcasts6/v4/00/49/fc/0049fc95-1329-4643-ad93-3baf54d8a928/mza_2273418040917995716.30x30-50.jpg',
        img60: 'http://a1.mzstatic.com/us/r30/Podcasts6/v4/00/49/fc/0049fc95-1329-4643-ad93-3baf54d8a928/mza_2273418040917995716.60x60-50.jpg',
        img600: 'http://a1.mzstatic.com/us/r30/Podcasts6/v4/00/49/fc/0049fc95-1329-4643-ad93-3baf54d8a928/mza_2273418040917995716.600x600-75.jpg',
        title: 'Seminargespräche',
        updated: 1389090240000 }
    }
    t.deepEqual(found, wanted())
    t.end()
  })
})

test('ENOTJSON', function (t) {
  var f = fanboy.lookup(opts())
  f.path = '/hello'
  f.on('error', function (er) {
    t.is(er.message, 'Unexpected "o" at position 1 in state NULL1')
    t.end()
  })
  f.write('123')
})

test('ENOTFOUND', function (t) {
  var mopts = opts()
  mopts.hostname = 'nasty'
  var f = fanboy.lookup(mopts)
  f.write('123', 'utf8')
  t.plan(1)
  f.on('error', function (er) {
    t.ok(er, 'should error')
    t.end()
  })
})

test('ECONNREFUSED', function (t) {
  var mopts = opts()
  mopts.port = 9998
  var f = fanboy.lookup(mopts)
  f.write('123', 'utf8')
  t.plan(1)
  f.on('error', function (er) {
    t.ok(er, 'should error')
    t.end()
  })
})

test('teardown', function (t) {
  server().close(function () {
    common.teardown(t)
  })
})
