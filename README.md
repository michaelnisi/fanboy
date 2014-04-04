
# fanboy - search iTunes store

The fanboy [Node.js](http://nodejs.org/) module implements cached search of the iTunes store. 

[![Build Status](https://secure.travis-ci.org/michaelnisi/fanboy.png)](http://travis-ci.org/michaelnisi/fanboy) [![David DM](https://david-dm.org/michaelnisi/fanboy.png)](http://david-dm.org/michaelnisi/fanboy)

## types

### log()
- [bunyan()](https://github.com/trentm/node-bunyan)

### db()
- [levelup()](https://github.com/rvagg/node-levelup)

## exports

### opts(country, db, hostname, log, media, method, path, port, reduce, term, ttl)
- country country || 'us'
- db db()
- hostname hostname || 'itunes.apple.com'
- log log()
- media = media || 'all'
- method method || 'GET'
- path path || '/search'
- port port || 443
- reduce reduce || function
- term term || '*'
- ttl ttl || 72 * 3600000

### search(opts())

### lookup(opts())

## License

[MIT License](https://github.com/michaelnisi/fanboy/blob/master/LICENSE)
