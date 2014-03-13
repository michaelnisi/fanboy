
// keys - keys as in kv

module.exports.key = key
module.exports.range = range

var DIV = module.exports.DIV = '\x00'
  , END = module.exports.END = '\xff'
  , FNB = module.exports.NME = 'fnb'
  , RES = module.exports.RES = 'res'
  , TRM = module.exports.TRM = 'trm'

// @doc
function selector (k) {
  return {
    'result': RES
  , 'term': TRM
  }[k]
}

function key (sel, name) {
  if (!sel || sel !== TRM && sel !== RES) {
    throw(new Error('invalid selector'))
  }
  return [FNB, sel, name].join(DIV)
}

function range (sel, name) {
  var start = key(sel, name)
  return {
    start: start
  , end: start += END
  , limit: 10
  }
}
