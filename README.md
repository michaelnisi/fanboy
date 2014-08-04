
# fanboy - search iTunes store

The Fanboy [Node.js](http://nodejs.org/) module implements cached search of the iTunes store. 

[![Build Status](https://secure.travis-ci.org/michaelnisi/fanboy.svg)](http://travis-ci.org/michaelnisi/fanboy) [![David DM](https://david-dm.org/michaelnisi/fanboy.svg)](http://david-dm.org/michaelnisi/fanboy)

## types

### db()

The mandatory [levelup](https://github.com/rvagg/node-levelup) instance.

### opts()

The options for the Fanboy store.

```js
- country String() | 'us'
- db db() | undefined 
- hostname String() | 'itunes.apple.com'
- media String() | 'all'
- method String() | 'GET'
- path String() | '/search'
- port Number() | 443
- readableObjectMode Boolean() | false
- reduce function | './lib/reduce'
- term String() | '*'
- ttl Number() | 72 * 3600000
```

## exports

Fanboy has a stateless API exporting three functions.

### search(opts())

Duplex stream where input is search terms as `String` or `Buffer` and output is search results as JSON `Buffer` or `Object`.

### lookup(opts())

Duplex stream where input is guids as `String` or `Buffer` and output is search results as JSON `Buffer` or `Object`.

### suggest(opts())

Duplex stream where input is search terms as `String` or `Buffer` and output is search terms as JSON `Buffer` or `String`.

## Installation

[![NPM](https://nodei.co/npm/fanboy.svg)](https://npmjs.org/package/fanboy)

## License

[MIT License](https://github.com/michaelnisi/fanboy/blob/master/LICENSE)
