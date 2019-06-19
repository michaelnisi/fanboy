'use strict'

// suggest.js -  get search suggestions from iTunes

const { keyStream, termFromKey } = require('./level')
const { debuglog } = require('util')
const { Writable, pipeline } = require('stream')

const debug = debuglog('fanboy')

exports.suggest = suggest

function suggest (term, { db, limit = 50 }, cb) {
  debug('suggesting: %s', term)

  const terms = []

  pipeline(
    keyStream(db, term, limit),
    new Writable({
      write (chunk, enc, cb) {
        const term = termFromKey(chunk)
        terms.push(term)
        cb()
      },
      decodeStrings: false
    }),
    error => {
      if (error) {
        return cb(error)
      }

      cb(error, terms)
    }
  )
}
