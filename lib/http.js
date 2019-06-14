'use strict'

// http.js - HTTP client for Apple iTunes API

const http = require('http')
const https = require('https')
const { debuglog } = require('util')
const { createResultsParser } = require('./json')
const { del, put } = require('./level')

const debug = debuglog('fanboy')

exports.request = request
exports.createResultsParser = createResultsParser

// Request lookup iTunes ID or search for term. Optional `keys` are used as
// fallback.
//
// - term String iTunes ID or search term.
// - keys [String] Array of cached keys (optional).
function request (term, keys, delegate, cb) {
  if (typeof keys === 'function') {
    cb = keys
    keys = null
  }

  const skip = () => {
    const y = delegate.cache.has(term)
    if (y) debug('skipping: %s', term)
    return y
  }

  if (skip()) {
    return cb()
  }

  const opts = delegate.reqOpts(term)
  debug(opts)

  const fallback = () => {
    debug('falling back')
    if (skip()) return cb()
    if (keys) {
      return delegate.resultsForKeys(keys, cb)
    }
    delegate.keysForTerm(term, (er, keys) => {
      if (er) {
        return cb(er.notFound ? null : er)
      }
      delegate.resultsForKeys(keys, cb)
    })
  }

  const mod = opts.port === 443 ? https : http

  const onresponse = (res) => {
    const { statusCode, headers } = res

    debug('HTTP ( %s, %o )', statusCode, headers)

    if (statusCode !== 200) {
      const er = new Error('fanboy: unexpected response ' + statusCode)
      er.statusCode = statusCode
      er.headers = res.headers
      Object.assign(er, opts)

      // We have to consume the response body to free up memory.
      res.resume()

      // Keeping the stream alive, I can’t remember why exactly.
      delegate.emit('error', er)

      return done()
    }

    // Parsing

    const parser = createResultsParser(res)
    const results = []

    function ondrain () {
      debug('drain event received')
      parser.resume()
    }

    const ondata = (obj) => {
      const result = delegate.result(obj)
      if (result) {
        results.push(result)
        const chunk = JSON.stringify(result)

        if (!delegate.use(chunk)) {
          debug('waiting for drain while readable flowing: %s', delegate.readableFlowing)
          delegate.once('drain', ondrain)
          parser.pause()
        }
      }
    }
    let faulty = false
    const onend = () => {
      if (results.length) {
        put(delegate.db, term, results, (er) => {
          parsed(er)
        })
      } else if (!faulty) {
        del(delegate.db, term, (er) => {
          delegate.cache.set(term, true)
          parsed(er)
        })
      } else {
        parsed()
      }
    }
    function onerror (error) {
      faulty = true
      const er = new Error('fanboy: parse error: ' + error.message)
      parsed(er)
    }
    const parsed = (er) => {
      delegate.removeListener('drain', ondrain)
      parser.removeListener('data', ondata)
      parser.removeListener('end', onend)
      parser.removeListener('error', onerror)
      done(er)
    }

    parser.on('data', ondata)
    parser.once('end', onend)
    parser.once('error', onerror)
  }

  // Requesting

  const req = mod.request(opts, onresponse)

  const done = (er) => {
    req.removeListener('aborted', onaborted)
    req.removeListener('error', onerror)
    req.removeListener('response', onresponse)

    if (er) {
      if (keys) {
        er.message = 'fanboy: falling back on cache'
        delegate.emit('error', er)
        return fallback()
      }
    }

    if (cb) cb(er)
  }

  function onaborted () {
    const er = new Error('fanboy: request aborted')
    done(er)
  }

  function onerror (error) {
    const er = Object.assign(new Error(), error)
    er.message = 'fanboy: ' + error.message
    done(er)
  }

  req.once('aborted', onaborted)
  req.once('error', onerror)

  req.end()
}
