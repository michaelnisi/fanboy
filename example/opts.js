
module.exports = opts

var levelup = require('levelup')

var _opts
function opts () {
  if (!_opts) {
    _opts = Object.create(null)
    _opts.media = 'podcast'
    _opts.db = levelup('/tmp/fanboy')
  }
  return _opts
}
