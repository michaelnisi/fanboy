
var fanboy = require('../')

function opts () {
  return fanboy.SearchOpts('podcast')
}

function term () {
  return process.argv.splice(2)[0] || '*'
}

var search = fanboy.Search(opts())
search.write(term(), 'utf8')
search.pipe(process.stdout)
search.end()
