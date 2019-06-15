'use strict'

// search.js - search iTunes

const { FanboyTransform } = require('./stream')
const { keysForTerm, createLevelRandom } = require('./level')
const { debuglog } = require('util')

const debug = debuglog('fanboy')

// Transforms search terms to search results.
class Search extends FanboyTransform {
  constructor (db, opts) {
    super(db, opts)

    this.path = '/search'
  }

  keysForTerm (term, cb) {
    keysForTerm(this.db, term, this.ttl, cb)
  }

  resultsForKeys (keys, cb) {
    const s = createLevelRandom(this.db)

    let read = () => {
      if (this._writableState.needDrain) return

      let ok = true
      let chunk

      while (ok && (chunk = s.read()) !== null) {
        ok = this.use(chunk)
      }

      if (!ok) {
        this.once('drain', read)
      } else {
        this.removeListener('drain', read)
      }
    }

    const notFound = []

    function onerror (error) {
      if (error.notFound) {
        notFound.push(error)
      } else {
        const er = new Error('fanboy: ' + error.message)
        done(er)
      }
    }

    function write () {
      let ok = false
      let chunk

      while ((chunk = keys.shift())) {
        ok = s.write(chunk)
      }

      if (!ok && keys.length > 0) {
        s.once('drain', write)
      } else {
        s.removeListener('drain', write)
        s.end()
      }
    }

    function onend () {
      let er

      const inconsistent = notFound.length > 0

      if (inconsistent) {
        er = new Error('fanboy: inconsistent database')
        er.reason = notFound
      }

      done(er)
    }

    s.once('end', onend)
    s.on('error', onerror)
    s.on('readable', read)

    function done (er) {
      s.removeListener('end', onend)
      s.removeListener('error', onerror)
      s.removeListener('readable', read)
      cb(er)
    }

    write()
  }

  _transform (chunk, enc, cb) {
    if (this.db.isClosed()) {
      return cb(new Error('fanboy: database closed'))
    }

    const term = this.decode(chunk)

    debug('searching: %s', term)

    this.keysForTerm(term, (er, keys) => {
      if (er) {
        if (er.notFound) {
          this._request(term, keys, cb)
        } else {
          cb(er)
        }
      } else {
        this.resultsForKeys(keys, cb)
      }
    })
  }
}

exports.Search = Search
