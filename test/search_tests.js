
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

function search (req, res) {
  var q = req.query
  if (q.term === 'gruber') {
    var p = path.join('./data', 'gruber.json')
    fs.createReadStream(p).pipe(res)
  } else {
    res.writeHead(404)
    res.end('not found\n')
  }
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
  routes().addRoute('/search*', search)
  server()
  common.setup(t)
})

function opts () {
  return common.opts()
}

test('simple', function (t) {
  var f = fanboy.search(opts())
  var buf = ''
  f.write('gruber')
  f.end()
  f.on('readable', function () {
    var chunk
    while (null !== (chunk = f.read())) {
      buf += chunk
    }
  })
  t.plan(1)
  f.on('finish', function () {
    var items = JSON.parse(buf)
    t.is(items.length, 13)
    t.end()
  })
})

test('teardown', function (t) {
  server().close(function () {
    common.teardown(t)
  })
})
