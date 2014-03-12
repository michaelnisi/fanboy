
# fanboy - search itunes store

The fanboy [Node.js](http://nodejs.org/) module implements cached search of the itunes store.

[![Build Status](https://secure.travis-ci.org/michaelnisi/fanboy.png)](http://travis-ci.org/michaelnisi/fanboy) [![David DM](https://david-dm.org/michaelnisi/fanboy.png)](http://david-dm.org/michaelnisi/fanboy)

## Usage

### Search podcasts
```js
var fanboy = require('fanboy')
  , levelup = require('levelup')
  , assert = require('assert')
  , bunyan = require('bunyan')

function loc () {
  return '/tmp/fanboy'
}

function opts (db) {
  var opts = fanboy.opts()
  opts.media = 'podcast'
  opts.db = db
  return opts
}

function term () {
  return process.argv.splice(2)[0] || '*'
}

function start (er, db) {
  assert(!er, er)
  var search = fanboy.search(opts(db))
  search.write(term(), 'utf8')
  search.pipe(process.stdout)
  search.end()
}

levelup(loc(), null, start)
```

### Example
```
node example/search_podcasts.js mule | json -a title
```

## API

### log()
- `log` [bunyan()](https://github.com/trentm/node-bunyan)

### db()
- `db` [levelup()](https://github.com/rvagg/node-levelup)

### opts()
- `db` db()
- `log` log() 

### search(opts())

### terms(db())

## License

[MIT License](https://raw.github.com/michaelnisi/fanboy/master/LICENSE)
