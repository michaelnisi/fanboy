'use strict'

// json.js - parse iTunes JSON

const JSONStream = require('JSONStream')
const { debuglog } = require('util')
const debug = debuglog('fanboy')

exports.createResultsParser = createResultsParser
exports.jsonResultsParser = jsonResultsParser

function jsonResultsParser () {
  return JSONStream.parse('results.*')
}

// Returns a readable results stream. Caution, this uses an ancient mad
// science JSON streaming module, which is not a Node stream class.
function createResultsParser (readable) {
  const parser = jsonResultsParser()

  function onerror (er) {
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
