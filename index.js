'use strict'

exports = module.exports = Fanboy

const events = require('events')
const lru = require('lru-cache')
const util = require('util')

const { FanboyTransform, defaults, mkpath, guid } = require('./lib/stream')
const { createResultsParser } = require('./lib/http')

const {
  createDatabase,
  close,
  resultForID,
  keysForTerm,
  isStale,
  keyStream,
  createLevelRandom,
  termFromKey,
  termOp,
  resOp,
  putOps
} = require('./lib/level')

const debug = util.debuglog('fanboy')

const TEST = process.mainModule.filename.match(/test/) !== null

function nop () {}

function sharedState (opts) {
  opts.cache = lru({ maxAge: opts.ttl, max: opts.max })
  return opts
}

// API

function Fanboy (name, opts) {
  if (!(this instanceof Fanboy)) return new Fanboy(name, opts)
  events.EventEmitter.call(this)
  opts = defaults(opts)
  this.db = createDatabase(name, opts.cacheSize)
  this.opts = sharedState(opts)
}
util.inherits(Fanboy, events.EventEmitter)

Fanboy.prototype.search = function () {
  return new Search(this.db, this.opts)
}

Fanboy.prototype.lookup = function () {
  return new Lookup(this.db, this.opts)
}

Fanboy.prototype.suggest = function (limit) {
  return new SearchTerms(this.db, this.opts, limit)
}

// --

if (TEST) {
  Fanboy.prototype.close = function (cb) {
    close(this.db, cb)
  }
}

// Lookup item in store
function Lookup (db, opts) {
  if (!(this instanceof Lookup)) return new Lookup(db, opts)
  FanboyTransform.call(this, db, opts)
  this.path = '/lookup'
}
util.inherits(Lookup, FanboyTransform)

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

function Search (db, opts) {
  if (!(this instanceof Search)) return new Search(db, opts)
  FanboyTransform.call(this, db, opts)
  this.path = '/search'
}
util.inherits(Search, FanboyTransform)

Search.prototype.keysForTerm = function (term, cb) {
  keysForTerm(this.db, term, this.ttl, cb)
}

Search.prototype.resultsForKeys = function (keys, cb) {
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

Search.prototype._transform = function (chunk, enc, cb) {
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

// Suggest search terms
function SearchTerms (db, opts, limit) {
  if (!(this instanceof SearchTerms)) return new SearchTerms(db, opts, limit)
  FanboyTransform.call(this, db, opts)
  this.limit = limit
}
util.inherits(SearchTerms, FanboyTransform)

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

if (TEST) {
  exports.base = FanboyTransform
  exports.debug = debug
  exports.defaults = defaults
  exports.guid = guid
  exports.isStale = isStale
  exports.keyStream = keyStream
  exports.lookup = Lookup
  exports.mkpath = mkpath
  exports.nop = nop
  exports.parse = createResultsParser
  exports.putOps = putOps
  exports.resOp = resOp
  exports.search = Search
  exports.suggest = SearchTerms
  exports.termOp = termOp
}
