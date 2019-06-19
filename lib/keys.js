'use strict'

// keys.js - keys as in schema

module.exports.key = key
module.exports.range = range
module.exports.rangeForTerm = rangeForTerm
module.exports.resKey = resKey
module.exports.termFromKey = termFromKey
module.exports.termKey = termKey

const assert = require('assert')
const StringDecoder = require('string_decoder').StringDecoder

const DIV = '\udbff\udfff'
const END = '\xff'
const FNB = 'fnb'
const RES = 'res'
const TRM = 'trm'

function termKey (term) {
  return key(TRM, term)
}

function resKey (id) {
  return key(RES, id)
}

function termFromKey (key) {
  const a = key.split(DIV)
  return a[2]
}

const decoder = new StringDecoder()

function trim (str) {
  if (typeof str === 'string') {
  } else if (typeof str === 'number') {
    str = String(str)
  } else if (str instanceof Buffer) {
    str = decoder.write(str)
  } else {
    assert(false, 'not a string, number, or buffer')
  }
  return str.split(' ').filter((char) => {
    return !!char
  }).join(' ')
}

function key (sel, name) {
  if (!sel || (sel !== TRM && sel !== RES)) {
    throw new Error('invalid selector')
  }
  return [FNB, sel, trim(name)].join(DIV)
}

function Range (start, end, limit = 50) {
  this.start = start
  this.end = end
  this.limit = limit
}

function range (sel, name, limit) {
  const start = key(sel, name)
  const end = start + END
  const r = new Range(start, end, limit)
  return r
}

function rangeForTerm (term, limit) {
  return range(TRM, term, limit)
}

exports.DIV = DIV
exports.END = END
exports.FNB = FNB
exports.RES = RES
exports.TRM = TRM
exports.trim = trim
