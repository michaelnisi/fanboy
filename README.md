
# fanboy - search iTunes store

The fanboy [Node.js](http://nodejs.org/) module implements cached search of the iTunes store. 

[![Build Status](https://secure.travis-ci.org/michaelnisi/fanboy.png)](http://travis-ci.org/michaelnisi/fanboy) [![David DM](https://david-dm.org/michaelnisi/fanboy.png)](http://david-dm.org/michaelnisi/fanboy)

## types

### log()
- [bunyan()](https://github.com/trentm/node-bunyan)

### db()
- [levelup()](https://github.com/rvagg/node-levelup)

## exports

### opts()
The options for the fanboy store.
```js
- country String() | 'us'
- db db()
- hostname String() | 'itunes.apple.com'
- log log()
- media = String() | 'all'
- method String() | 'GET'
- path String() | '/search'
- port Number() | 443
- reduce function
- term String() | '*'
- ttl Number() | 72 * 3600000
```

### search(opts())

### lookup(opts())

## License

[MIT License](https://github.com/michaelnisi/fanboy/blob/master/LICENSE)
