
var Search = require('../').Search

function term () {
  return process.argv.splice(2)[0]
}

var search = new Search()
search.write(term(), 'utf8')
search.pipe(process.stdout)
search.end()
