'use strict'

// lookup.js -  lookup specific items

const { inherits } = require('util')
const { FanboyTransform } = require('./stream')
const { resultForID } = require('./level')
const { debuglog } = require('util')

const debug = debuglog('fanboy')

exports.Lookup = Lookup

// Lookup item in store
function Lookup (db, opts) {
  if (!(this instanceof Lookup)) return new Lookup(db, opts)
  FanboyTransform.call(this, db, opts)

  this.path = '/lookup'
}

inherits(Lookup, FanboyTransform)

// - chunk iTunes ID (e.g. '537879700')
Lookup.prototype._transform = function (chunk, enc, cb) {
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
