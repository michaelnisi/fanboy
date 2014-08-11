
module.exports = opts

var levelup = require('levelup')

var _opts
function opts () {
  return _opts || (_opts = {
    media: 'podcast'
  , db: levelup('/tmp/fanboy')
  })
}
