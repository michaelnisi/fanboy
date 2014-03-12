
// keys - keys as in kv

module.exports.key = key
module.exports.range = range

var TRM = module.exports.TRM = 'trm'
  , DIV = module.exports.DIV = '\x00'
  , END = module.exports.END = '\xff'

// @doc
function selector (k) {
  return {
    'term': TRM
  }[k]
}

function key (sel, term) {
  if (!sel || (sel !== TRM)) {
    throw(new Error('invalid selector'))
  }
  return [sel, term].join(DIV)
}

function range (sel, term) {
  var start = key(sel, term)
  return {
    start: start
  , end: start += END
  , limit: 10
  }
}
