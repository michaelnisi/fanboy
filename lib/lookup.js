'use strict'

// lookup.js -  lookup specific items

const { writeResults, resultForID, guid } = require('./level')
const { Writable, pipeline, Transform } = require('stream')
const { jsonResultsParser } = require('./json')
const { request } = require('./http')
const { debuglog } = require('util')

const debug = debuglog('fanboy')

exports.lookup = lookup

/**
 * Issues an HTTP request storing the result. When done, the callback receives
 * an error if something went wrong and hopefully the matching item.
 */
function requestLookup (iTunesId, { db, cache }, cb) {
  debug('requesting lookup: %s', iTunesId)

  const responseHandler = (err, res) => {
    if (err) {
      debug('request failed: %o', err)
      return cb(err)
    }

    if (res.statusCode !== 200) {
      return cb(new Error(`unexpected HTTP status code: ${res.statusCode}`))
    }

    debug('creating lookup request pipeline')

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

        debug(chunksCount)

        if (chunksCount === 0) {
          return cb(new Error('nothing to read'))
        }

        writeResults({ db, cache, term: iTunesId, results }, (err, items) => {
          cb(err, items ? items[0] : null)
        })
      }
    )
  }

  request({
    path: '/lookup',
    term: iTunesId,
    responseHandler: responseHandler
  }).end()
}

function isGUID (value) {
  return parseInt(value, 10)
}

/**
 * Lookup items matching guids. The two code paths are:
 *
 * - HTTP request and update database
 * - Read values from database
 */
function lookup (iTunesId, { db, ttl, cache }, cb) {
  if (!isGUID(iTunesId)) {
    return cb(new Error('invalid iTunes ID'))
  }

  resultForID(db, iTunesId, (err, item) => {
    if (err) {
      if (err.notFound) {
        requestLookup(iTunesId, { db, cache }, cb)
      } else {
        cb(err)
      }
    } else if (item !== undefined) {
      cb(null, item)
    } else {
      cb(new Error('unexpected database problem'))
    }
  })
}
