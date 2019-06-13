// level - access LevelDB

const keys = require('./keys')
const levelup = require('levelup')
const lr = require('level-random')

// TODO: Shrink surface-area

exports.createDatabase = createDatabase
exports.close = close
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

function createDatabase (name, cacheSize) {
  return levelup(name, {
    cacheSize: cacheSize
  })
}

function createLevelRandom (db) {
  return lr(new LROpts(db))
}

function close (db, cb) {
  db.close(cb)
}

function put (db, term, results, cb) {
  if (results && results.length) {
    db.batch(putOps(term, results), cb)
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
      try {
        keys = JSON.parse(value)
        // The first key is a timestamp, I guess.
        if (isStale(keys.shift(), ttl)) {
          er = new Error('fanboy: stale keys for ' + term)
          er.notFound = true
        }
      } catch (ex) {
        er = ex
      }
    }
    cb(er, keys)
  })
}

function isStale (time, ttl) {
  return Date.now() - time > ttl
}

function keyStream (db, term, limit) {
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

function LROpts (db) {
  this.db = db
  this.fillCache = true
  this.errorIfNotExists = true
}