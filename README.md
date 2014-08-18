
# fanboy - search iTunes store

The Fanboy [Node.js](http://nodejs.org/) package implements cached search in the iTunes store using the [iTunes Search API](https://www.apple.com/itunes/affiliates/resources/documentation/itunes-store-web-service-search-api.html).

[![Build Status](https://secure.travis-ci.org/michaelnisi/fanboy.svg)](http://travis-ci.org/michaelnisi/fanboy) [![David DM](https://david-dm.org/michaelnisi/fanboy.svg)](http://david-dm.org/michaelnisi/fanboy)

## Usage

```js
var fanboy = require('fanboy')
  , levelup = require('levelup')
  ;
var f = fanboy({
  media:'podcast'
, db:levelup('/tmp/fanboy')
})
```

```js
var search = f.search()
search.end('merlin mann')
search.pipe(process.stdout)
```

```
$ node example/search.js | json
```

```js
var lookup = f.lookup()
lookup.end('471418144')
lookup.pipe(process.stdout)
```

```
$ node example/lookup.js | json
```

```js
var suggest = f.suggest()
suggest.end('mer')
suggest.pipe(process.stdout)
```

```
$ node example/suggest.js | json
```

## types

### db()

The mandatory [LevelUP](https://github.com/rvagg/node-levelup) instance.

### opts()

The options for the Fanboy `cache`:

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
- ttl Number() | 72 * 3600000
```

## exports

### fanboy(opts())

To access the `Fanboy` class `require('fanboy')`.

### fanboy.search()

[Transform](http://nodejs.org/api/stream.html#stream_class_stream_transform)  stream where input is search terms as `String` or `Buffer` and output is search results as `JSON` `Buffer` or `Object`.

### fanboy.lookup()

[Transform](http://nodejs.org/api/stream.html#stream_class_stream_transform) stream where input is guids as `String` or `Buffer` and output is search results as `JSON` `Buffer` or `Object`.

### fanboy.suggest()

[Transform](http://nodejs.org/api/stream.html#stream_class_stream_transform) stream where input is search terms as `String` or `Buffer` and output is search terms as `JSON` `Buffer` or `String`.

## Installation

With [npm](https://npmjs.org/package/fanboy) do:

```
$ npm install fanboy
```

## License

[MIT License](https://github.com/michaelnisi/fanboy/blob/master/LICENSE)
