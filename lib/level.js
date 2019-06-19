'use strict'

// level.js - access LevelDB

const keys = require('./keys')
const level = require('level')
const lr = require('level-random')
const { debuglog } = require('util')
const keyEncoding = require('charwise')
const { Readable } = require('stream')

const debug = debuglog('fanboy')

exports.createLevelDB = createLevelDB
exports.del = del
exports.put = put
exports.resultForID = resultForID
exports.keysForTerm = keysForTerm
exports.isStale = isStale
exports.keyStream = keyStream
exports.createLevelRandom = createLevelRandom
exports.termFromKey = termFromKey
exports.termOp = termOp
exports.resOp = resOp
exports.putOps = putOps
exports.guid = guid
exports.writeResults = writeResults

/**
 * Creates a new LevelDB database with
 * [charwise](https://github.com/dominictarr/charwise)
 * key encoding.
 */
function createLevelDB (location, cacheSize = 8 * 1024 * 1024) {
  return level(location, {
    keyEncoding: keyEncoding,
    cacheSize: cacheSize
  })
}

/**
 * Empty results delete any previously stored results.
 */
function writeResults ({ db, cache, term, results }, cb) {
  debug('writing results: %s', term)

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

function guid (obj) {
  if (!obj) {
    return obj
  }

  obj.guid = obj.collectionId

  return obj
}

function LROpts (db) {
  this.db = db
  this.fillCache = true
  this.errorIfNotExists = true
  this.objectMode = true
}

function createLevelRandom (db) {
  return lr(new LROpts(db))
}

function put (db, term, results, cb) {
  debug('putting: %o', term)
  if (results && results.length) {
    const opts = putOps(term, results)

    db.batch(opts, cb)
  } else {
    cb(new Error('fanboy: cannot store empty results'))
  }
}

function del (db, term, cb) {
  db.del(keys.termKey(term), cb)
}

// The result as JSON string
// - db levelup()
// - id the iTunes ID
// - cb cb(er, value)
function resultForID (db, id, cb) {
  const key = keys.resKey(id)
  db.get(key, (er, value) => {
    cb(er, value)
  })
}

function termFromKey (chunk) {
  return keys.termFromKey(chunk)
}

function keysForTerm (db, term, ttl, cb) {
  const key = keys.termKey(term)

  db.get(key, (er, value) => {
    let keys

    if (!er && !!value) {
      keys = JSON.parse(value)

      if (isStale(keys.shift(), ttl)) {
        er = new Error('fanboy: stale keys for ' + term)
        er.notFound = true
      }
    }

    cb(er, keys)
  })
}

function isStale (time, ttl) {
  return Date.now() - time > ttl
}

function keyStream (db, term, limit) {
  if (db.isClosed()) {
    return new Readable({
      read () {
        this.emit('error', new Error('Database is closed'))
      }
    })
  }

  return db.createKeyStream(keys.rangeForTerm(term, limit))
}

// Bulk-write operation
function Bulk (type, key, value) {
  this.type = type
  this.key = key
  this.value = value
}

function termOp (term, kees, now = Date.now()) {
  const k = keys.termKey(term)
  const v = JSON.stringify([now].concat(kees))

  return new Bulk('put', k, v)
}

function resOp (result, now = Date.now()) {
  result.ts = now
  const k = keys.resKey(result.guid)
  const v = JSON.stringify(result)

  return new Bulk('put', k, v)
}

function putOps (term, results, now) {
  const ops = []

  const keys = results.map((result) => {
    const op = resOp(result, now)

    ops.push(op)

    return op.key
  })

  ops.push(termOp(term, keys, now))

  return ops
}
