'use strict'

// json.js - parse iTunes JSON

const JSONStream = require('JSONStream')
const { debuglog } = require('util')
const debug = debuglog('fanboy')

exports.createResultsParser = createResultsParser

function createResultsParser (readable) {
  const parser = JSONStream.parse('results.*')

  function onerror (er) {
    debug(er)
    parser.end()
    onend()
  }

  function onend () {
    debug('parser ended')
    parser.removeListener('end', onend)
    parser.removeListener('error', onerror)
    readable.unpipe()
  }

  parser.on('end', onend)
  parser.on('error', onerror)

  return readable.pipe(parser)
}
