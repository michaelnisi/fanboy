'use strict'

// suggest.js -  get search suggestions from iTunes

const { inherits } = require('util')
const { FanboyTransform } = require('./stream')
const { keyStream, termFromKey } = require('./level')
const { debuglog } = require('util')

const debug = debuglog('fanboy')

exports.SearchTerms = SearchTerms

// Suggest search terms
function SearchTerms (db, opts, limit) {
  if (!(this instanceof SearchTerms)) return new SearchTerms(db, opts, limit)
  FanboyTransform.call(this, db, opts)

  this.limit = limit
}

inherits(SearchTerms, FanboyTransform)

SearchTerms.prototype._transform = function (chunk, enc, cb) {
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
