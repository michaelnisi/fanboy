// keys - keys as in schema

module.exports.key = key
module.exports.range = range
module.exports.rangeForTerm = rangeForTerm
module.exports.resKey = resKey
module.exports.termFromKey = termFromKey
module.exports.termKey = termKey

var assert = require('assert')
var string_decoder = require('string_decoder')

var DIV = '\udbff\udfff'
var END = '\xff'
var FNB = 'fnb'
var RES = 'res'
var TRM = 'trm'

function termKey (term) {
  return key(TRM, term)
}

function resKey (id) {
  return key(RES, id)
}

function termFromKey (key) {
  var a = key.split(DIV)
  if (a instanceof Array) return a[2]
  return null
}

var decoder = new string_decoder.StringDecoder()

function trim (str) {
  if (typeof str === 'string') {
  } else if (typeof str === 'number') {
    str = String(str)
  } else if (str instanceof(Buffer)) {
    str = decoder.write(str)
  } else {
    assert(false, 'not a string, number, or buffer')
  }
  return str.split(' ').filter(function (char) {
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
  var start = key(sel, name)
  return new Range(start, start += END, 50)
}

function rangeForTerm (term) {
  return range(TRM, term)
}

if (process.env.NODE_TEST) {
  exports.DIV = DIV
  exports.END = END
  exports.FNB = FNB
  exports.RES = RES
  exports.TRM = TRM
  exports.trim = trim
}
