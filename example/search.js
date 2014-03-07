
var Search = require('../').Search

var search = new Search()
search.write('pritlove', 'utf8')
search.pipe(process.stdout)
