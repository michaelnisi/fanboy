# fanboy - cache itunes search

The **fanboy** [Node.js](http://nodejs.org/) package implements a cache for parts of the [iTunes Search API](https://www.apple.com/itunes/affiliates/resources/documentation/itunes-store-web-service-search-api.html).

[![Build Status](https://secure.travis-ci.org/michaelnisi/fanboy.svg)](http://travis-ci.org/michaelnisi/fanboy)

## Types

### void()

Compound type representing `undefined` or `null`.

### reduce()

A `function` applied to each [iTunes search result](https://www.apple.com/itunes/affiliates/resources/documentation/itunes-store-web-service-search-api.html#understand). The default `lib/reduce.js`—for podcasts—produces:

- `author` `String()`
- `feed` `String()`
- `guid` `Number()`
- `img100` `String()`
- `img30` `String()`
- `img60` `String()`
- `img600` `String()`
- `title` `String()`
- `updated` `Number()`
- `ts` `Number()`

### opts()

The options for the **fanboy** cache:

- `cacheSize` `Number` The cache size passed to [`levelup`](https://github.com/Level/levelup).
- `country` `String` The country code for the search API—defaults to 'us'.
- `highWaterMark` `Number` Passed to `stream.Readable` constructor.
- `hostname` `String` The host name of the store (`'itunes.apple.com'`).
- `media` `String` The media type to search for (`'all'`).
- `objectMode` `Boolean` Whether this stream should behave as a stream of objects (`false`).
- `path` `String` The path to the store (`/search`).
- `port` `Number` The port to access the store (`80`).
- `reduce` `reduce()`
- `ttl` `Number` Time to live in milliseconds (`24 * 3600 * 1000`).

## Exports

The **fanboy** module exports a single function that returns a new cache object (an instance of the `Fanboy` class). To access the `Fanboy` class `require('fanboy')`.

### Creating a new cache

`fanboy(name, opts)`

- `name` `String()` The name of the file system directory for the database.
- `opts` `opts() | void()` Optional parameters of the cache.

```js
var fanboy = require('fanboy')

var cache = fanboy('/tmp/fanboy.db', {
  type: 'podcast'
})
```

### Searching the cache

```js
var search = cache.search()
search.end('merlin mann')
search.pipe(process.stdout)
```

To run this printing only the title(s), do:

```
$ node example/search | json -ga title
```

This will search remotely and cache the result, subsequent requests will use the cache.

### Looking up a guid

```js
var lookup = cache.lookup()
lookup.end('471418144')
lookup.pipe(process.stdout)
```

You can run this with:

```
$ node example/lookup | json
```

### Getting suggestions for search terms

```js
var suggest = cache.suggest()
suggest.end('m')
suggest.pipe(process.stdout)
```

Try:

```
$ node example/suggest | json
```

If you have not searched before doing this, you will not get any results, because the suggestions index is populated as we are caching data.

### Overriding stream options

The `search`, `lookup`, and `suggest` functions accept an optional stream options `Object` that lets you override global stream options—`highWaterMark`, `encoding`, and `objectMode`—of your `fanboy` instance.

## Installation

With [npm](https://npmjs.org/package/fanboy) do:

```
$ npm install fanboy
```

## License

[MIT License](https://github.com/michaelnisi/fanboy/blob/master/LICENSE)
