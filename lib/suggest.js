'use strict'

// suggest.js -  get search suggestions from iTunes

const { FanboyTransform } = require('./stream')
const { keyStream, termFromKey } = require('./level')
const { debuglog } = require('util')

const debug = debuglog('fanboy')

// Transforms terms to suggested search terms.
class SearchTerms extends FanboyTransform {
  constructor (db, opts, limit) {
    super(db, opts)

    this.limit = limit
  }

  _transform (chunk, enc, cb) {
    if (this.db.isClosed()) {
      return cb(new Error('fanboy: database closed'))
    }

    const term = this.decode(chunk)
    debug('suggesting: %s', term)

    const reader = keyStream(this.db, term, this.limit)

    const read = () => {
      let chunk
      let ok
      let sug

      do {
        chunk = reader.read()
        if (chunk) {
          sug = termFromKey(chunk)
          ok = this.use('"' + sug + '"')
        }
      } while (chunk && ok)
      if (ok === false) {
        this.once('drain', read)
      }
    }

    function onerror (error) {
      const er = new Error('fanboy: failed to stream keys: ' + error.message)
      er.term = term
      done(er)
    }

    function done (er) {
      if (!cb) return

      reader.removeListener('drain', read)
      reader.removeListener('end', done)
      reader.removeListener('error', onerror)
      reader.removeListener('readable', read)

      cb(er)
    }

    reader.once('end', done)
    reader.once('error', onerror)
    reader.on('readable', read)
  }
}

exports.SearchTerms = SearchTerms
