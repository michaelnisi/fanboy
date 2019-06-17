'use strict'

const common = require('./lib/common')
const http = require('http')
const test = require('tap').test
const { URL } = require('url')
const { createPath, request } = require('../lib/v2/http')

test('creating iTunes API path', t => {
  t.is(createPath('/search', 'apple'), '/search?media=all&country=us&term=apple')
  t.is(createPath('/lookup', '123'), '/lookup?id=123')
  t.throws(() => { createPath('/hello', 'dog') })
  t.end()
})

test('aborted', t => {
  const req = request('/search', 'abortion', (er, res) => {
    t.is(er.message, 'fanboy: request aborted')
    t.end()
  })
  req.abort()
})

function codesBetween (smaller, larger) {
  let codes = []

  while (smaller <= larger) {
    codes.push(smaller++)
  }

  return codes
}

function createHeaders () {
  return {
    'content-type': 'text/javascript; charset=utf-8'
  }
}

function createURL (input = '/search?media=podcast&country=us&term=apple') {
  return new URL(input, 'http://localhost:1337')
}

// Arbitrary HTTP status codes should not hang the stream.
function run (codes, t) {
  const { hostname, port } = createURL()
  const headers = createHeaders()

  const fixtures = codes.map((code) => {
    return (req, res) => {
      t.same(createURL(req.url), createURL())
      res.writeHead(code, headers)
      res.end()
    }
  })

  const server = http.createServer((req, res) => {
    fixtures.shift()(req, res)
  }).listen(port, hostname, er => {
    if (er) throw er
    t.pass(`should listen on ${port}`)
    go()
  })

  const go = () => {
    let code = codes.shift()

    if (!code) {
      return server.close(er => {
        if (er) throw er
        t.end()
      })
    }

    const cache = common.freshCache(null, hostname, port)
    const f = cache.search()
    let chunks = []

    f.on('data', chunk => {
      chunks.push(chunk)
    })

    let errorEmitted = false

    f.on('end', er => {
      let wanted = []
      let found = JSON.parse(Buffer.concat(chunks).toString())

      t.same(wanted, found)
      t.ok(errorEmitted)

      common.teardown(cache, () => {
        t.pass('should teardown')
        go(codes, t)
      })
    })

    f.on('error', er => {
      if (code === 100) {
        t.is(er.code, 'ECONNRESET')
      } else {
        // t.is(er.statusCode, code, `${er}`)
      }

      errorEmitted = true
    })

    f.resume()
    f.end('apple')
  }
}

test('1xx', t => {
  run(codesBetween(100, 103), t)
})

test('3xx', t => {
  run(codesBetween(300, 310), t)
})

test('4xx', t => {
  run(codesBetween(400, 430), t)
})

test('5xx', t => {
  run(codesBetween(500, 510), t)
})
