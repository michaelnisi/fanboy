'use strict'

// lookup.js -  lookup specific items

const { FanboyTransform } = require('./stream')
const { resultForID } = require('./level')
const { debuglog } = require('util')

const debug = debuglog('fanboy')

// Transforms iTunes IDs to items.
class Lookup extends FanboyTransform {
  constructor (db, opts) {
    super(db, opts)

    this.path = '/lookup'
  }

  // - chunk iTunes ID (e.g. '537879700')
  _transform (chunk, enc, cb) {
    if (this.db.isClosed()) {
      return cb(new Error('fanboy: database closed'))
    }

    const db = this.db
    const guid = this.decode(chunk)

    debug('looking up: %s', guid)

    if (!parseInt(guid, 10)) {
      this.emit('error', new Error('fanboy: guid ' + guid + ' is not a number'))
      return cb()
    }

    resultForID(db, guid, (er, value) => {
      if (er) {
        if (er.notFound) {
          return this._request(guid, cb)
        }
      } else if (value !== undefined) {
        this.use(value)
      }
      cb(er)
    })
  }
}

exports.Lookup = Lookup
