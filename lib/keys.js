'use strict'

// keys - keys as in schema

module.exports.key = key
module.exports.range = range
module.exports.rangeForTerm = rangeForTerm
module.exports.resKey = resKey
module.exports.termFromKey = termFromKey
module.exports.termKey = termKey

const TEST = process.mainModule.filename.match(/test/) !== null

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
  if (a instanceof Array) return a[2]
  return null
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
  if (!sel || sel !== TRM && sel !== RES) {
    throw new Error('invalid selector')
  }
  return [FNB, sel, trim(name)].join(DIV)
}

function Range (start, end, limit) {
  this.start = start
  this.end = end
  this.limit = limit
}

function range (sel, name) {
  const start = key(sel, name)
  const end = start + END
  return new Range(start, end, 50)
}

function rangeForTerm (term) {
  return range(TRM, term)
}

if (TEST) {
  exports.DIV = DIV
  exports.END = END
  exports.FNB = FNB
  exports.RES = RES
  exports.TRM = TRM
  exports.trim = trim
}
