
# fanboy - cache itunes search

The **fanboy** [Node.js](http://nodejs.org/) package implements a cache for parts of the [iTunes Search API](https://www.apple.com/itunes/affiliates/resources/documentation/itunes-cache-web-service-search-api.html).

[![Build Status](https://secure.travis-ci.org/michaelnisi/fanboy.svg)](http://travis-ci.org/michaelnisi/fanboy)

## Usage

```js
var fanboy = require('fanboy')
var levelup = require('levelup')

var cache = fanboy({media:'podcast', db:levelup('/tmp/fanboy')})
```

```js
var search = cache.search()
search.end('merlin mann')
search.pipe(process.stdout)
```

```
$ node example/search.js | json
```

```js
var lookup = cache.lookup()
lookup.end('471418144')
lookup.pipe(process.stdout)
```

```
$ node example/lookup.js | json
```

```js
var suggest = cache.suggest()
suggest.end('m')
suggest.pipe(process.stdout)
```

```
$ node example/suggest.js | json
```

## types

### opts()

The options for the **fanboy** cache:

- `country` `String` which defaults to `'us'`
- `db` The mandatory [LevelUP](https://github.com/rvagg/node-levelup) instance
- `hostname` `String` which defaults to `'itunes.apple.com'`
- `media` `String` which defaults to `'all'`
- `method` `String` which defaults to `'GET'`
- `path` `String` which defautls to `'/search'`
- `port` `Number` which defaults to `80`
- `readableObjectMode` `Boolean` which defaults to `false`
- `reduce` `function` which defaults to the `lib/reduce` module
- `ttl` Time to live `Number` which defaults to `72 * 3600000`

## exports

The **fanboy** module exports a single function that returns a new cache object (an instance of the `Fanboy` class). To access the `Fanboy` class `require('fanboy')`.

```js
var fanboy = require('fanboy')
var cache = fanboy(opts())
```

### cache.search()

[Transform](http://nodejs.org/api/stream.html#stream_class_stream_transform)  stream where input is search terms as `String` or `Buffer` and output is search results as JSON `Buffer` or `Object`.

### cache.lookup()

[Transform](http://nodejs.org/api/stream.html#stream_class_stream_transform) stream where input is guids as `String` or `Buffer` and output is search results as JSON `Buffer` or `Object`.

### cache.suggest()

[Transform](http://nodejs.org/api/stream.html#stream_class_stream_transform) stream where input is search terms as `String` or `Buffer` and output is search terms as JSON `Buffer` or `String`.

## Installation

With [npm](https://npmjs.org/package/fanboy) do:

```
$ npm install fanboy
```

## License

[MIT License](https://github.com/michaelnisi/fanboy/blob/master/LICENSE)
