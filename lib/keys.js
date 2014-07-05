
// keys - keys as in kv

module.exports.key = key
module.exports.range = range

var DIV = module.exports.DIV = '\x00'
  , END = module.exports.END = '\xff'
  , FNB = module.exports.NME = 'fnb'
  , RES = module.exports.RES = 'res'
  , TRM = module.exports.TRM = 'trm'
  ;

module.exports.TERMS = [FNB, TRM].join(DIV)
module.exports.RESULTS = [FNB, RES].join(DIV)

var string_decoder = require('string_decoder')
  , assert = require('assert')
  ;

function trim (str) {
  if (typeof str === 'number') {
    str = String(str)
  } else if (typeof str !== 'string') {
    str = new string_decoder.StringDecoder().write(str)
  }
  var chunks = []
  str.split(' ').forEach(function (chunk) {
    if (chunk) chunks.push(chunk)
  })
  return chunks.join(' ')
}

function key (sel, name) {
  if (!sel || sel !== TRM && sel !== RES) {
    throw(new Error('invalid selector'))
  }
  return [FNB, sel, trim(name)].join(DIV)
}

function range (sel, name) {
  var start = key(sel, name)
  return {
    start: start
  , end: start += END
  , limit: 10
  }
}

if (process.env.NODE_TEST) {
  module.exports.trim = trim
}
