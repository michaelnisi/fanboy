'use strict'

// http.js - HTTP client for Apple iTunes API

const http = require('http')
const https = require('https')
const { stringify } = require('querystring')
const { env } = require('./init')
const { debuglog } = require('util')

const debug = debuglog('fanboy')

exports.request = request
exports.createPath = createPath

const verbs = { '/search': 'term', '/lookup': 'id' }

function decorate (obj, path, term) {
  obj[verbs[path]] = term

  return obj
}

/**
 * Returns a path constructed for the iTunes API.
 *
 * @throws Throws 'unknown path' if the local `verbs` have no match.
 */
function createPath (path, term, { media = 'all', country = 'us', attribute } = {}) {
  if (!verbs.hasOwnProperty(path)) {
    throw new Error('unknown path')
  }

  const obj = (() => {
    if (path === '/lookup') return Object.create(null)

    const o = {
      media: media,
      country: country
    }

    if (attribute) o.attribute = attribute

    return o
  })()

  // Note: URL encoding replaces spaces with the plus (+) character and all
  // characters except the following are encoded: letters, numbers, periods
  // (.), dashes (-), underscores (_), and asterisks (*).

  const q = stringify(decorate(obj, path, term))

  return [path, q].join('?')
}

function ReqOpts ({
  hostname = 'localhost',
  keepAlive = true,
  port = 8080,
  method = 'GET',
  path = '/'
}) {
  this.hostname = hostname
  this.keepAlive = keepAlive
  this.method = method
  this.path = path
  this.port = port
}

/**
 * Issues an HTTP request at `path` ('/search' or '/lookup') to query `term`,
 * passing resulting error and response into `cb` once the response body gets
 * available to be consumed. Upon receiving an error, the callback should
 * dismiss the readable response stream without adding listeners to it.
 *
 * Response handling lies in the responsibility of the callback. Pass `opts`
 * for overriding global environment settings during testing.
 */
function request ({ path, term, responseHandler }, opts = env()) {
  const onabort = () => {
    const err = new Error('fanboy: request aborted')

    done(err)
  }

  const onerror = (error) => {
    const err = Object.assign(new Error(), error)
    err.message = 'fanboy: ' + error.message

    done(err)
  }

  const onresponse = (res) => {
    // TODO: Inspect headers: who are we talking to?

    done(null, res)
  }

  const p = createPath(path, term, env())
  const reqOpts = new ReqOpts(Object.assign({ path: p }, opts))

  debug('issueing request: %o', reqOpts)

  const mod = opts.port === 443 ? https : http
  const req = mod.request(reqOpts, onresponse)

  const ontimeout = () => {
    debug('aborting request: socket has been idle')

    // Assuming we will redundantly receive ECONNRESET, but that might be
    // a Nock quirk. Needs investigation.

    req.removeListener('abort', onabort)
    req.abort()
  }

  // Before leaving this scope, call done with error and response.
  function done (err, res) {
    req.removeListener('abort', onabort)
    req.removeListener('error', onerror)
    req.removeListener('response', onresponse)
    req.removeListener('timeout', ontimeout)

    if (responseHandler) responseHandler(err, res)
  }

  req.once('abort', onabort)
  req.once('error', onerror)
  req.once('timeout', ontimeout)
  req.setTimeout(3000)

  return req
}
