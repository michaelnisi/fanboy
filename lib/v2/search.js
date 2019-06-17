'use strict'

// search.js - search iTunes

const { keysForTerm, createLevelRandom, put, del, guid } = require('../level')
const { Readable, Writable, pipeline, Transform } = require('stream')
const { jsonResultsParser } = require('../json')
const { request } = require('./http')
const { debuglog } = require('util')

const debug = debuglog('fanboy')

exports.search = search

/**
 * Empty results delete any previously stored results.
 */
function writeResults ({ db, cache, term, results }, cb) {
  debug('writing results: %s', db)

  if (results.length) {
    put(db, term, results, (err) => {
      debug('submitting callback: ( %s, %s )', err, results.length)
      cb(err, results)
    })
  } else {
    del(db, term, (err) => {
      cache.set(term, true)
      debug('submitting callback: ( %s, %s )', err, results.length)
      cb(err, results)
    })
  }
}

/**
 * Issues an HTTP request storing the result. When done, the callback receives
 * an error, when something went wrong, and an Array of results.
 */
function requestSearch (term, { db, cache }, cb) {
  debug('requesting search: %s', term)

  request({
    path: '/search',
    term: term,
    responseHandler: (err, res) => {
      if (err) {
        debug('request failed: %o', err)
        return cb(err)
      }

      if (res.statusCode !== 200) {
        return cb(new Error(`unexpected HTTP status code: ${res.statusCode}`))
      }

      debug('creating search request pipeline')

      const results = []

      // If we have not received any chunks after the pipeline has ended,
      // something went wrong and we must return without touching the
      // database. Without this extra check, we cannot interpret an
      // empty results Array properly. Our JSON parser does not  emit
      // errors if it cannot find what it’s looking for, only for invalid
      // JSON. We are counting with an interposed Transform stream.
      let chunksCount = 0

      pipeline(
        res,
        new Transform({
          transform (chunk, enc, cb) {
            chunksCount++
            this.push(chunk)
            cb()
          }
        }),
        jsonResultsParser(),
        new Writable({
          objectMode: true,
          write (result, enc, cb) {
            results.push(guid(result))
            cb()
          }
        }),
        err => {
          if (err) {
            debug('pipeline failed: %s', err.message)
            return cb(err)
          }

          // Nock seems to terminate too early.

          // if (!res.complete) {
          //   return cb(new Error('terminated while the message was still being sent'))
          // }

          if (chunksCount === 0) {
            return cb(new Error('nothing to read'))
          }

          writeResults({ db, cache, term, results }, cb)
        }
      )
    } }).end()
}

/**
 * Reads values for `keys` from `db`.
 */
function read (db, keys, cb) {
  const results = []

  pipeline(
    new Readable({
      read (size) {
        this.push(keys.shift() || null)
      }
    }),
    createLevelRandom(db),
    new Writable({
      write (chunk, enc, cb) {
        results.push(chunk)
        cb()
      }
    }),
    err => {
      cb(err, results)
    }
  )
}

/**
 * Search items matching term. The two code paths are:
 *
 * - HTTP request and write to database
 * - Read values from database
 */
function search (term, { db, ttl, cache }, cb) {
  keysForTerm(db, term, ttl, (err, keys) => {
    if (err) {
      if (err.notFound) {
        requestSearch(term, { db, cache }, cb)
      } else {
        cb(err)
      }
    } else {
      read(db, keys, cb)
    }
  })
}
