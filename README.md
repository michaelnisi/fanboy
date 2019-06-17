[![Build Status](https://secure.travis-ci.org/michaelnisi/fanboy.svg)](http://travis-ci.org/michaelnisi/fanboy)
[![Coverage Status](https://coveralls.io/repos/github/michaelnisi/fanboy/badge.svg?branch=master)](https://coveralls.io/github/michaelnisi/fanboy?branch=master)

# fanboy

The **fanboy** [Node.js](http://nodejs.org/) package implements proxy caching for parts of the [iTunes Search API](https://www.apple.com/itunes/affiliates/resources/documentation/itunes-store-web-service-search-api.html).

## Types

### void()

`null` or `undefined`.

### result(obj)

A map or filter callback applied with each JSON result `obj`.

- `obj` The original, JSON parsed, [iTunes search result](https://www.apple.com/itunes/affiliates/resources/documentation/itunes-store-web-service-search-api.html#understand) object.

Returns result or `void()`.

The default callback adds the required `guid` property to `obj` and returns it. For production I’d return a classy object.

### opts()

The options for the **fanboy** cache:

- `cacheSize = 1024 * 1024 * 8` The *leveldown* in-memory LRU cache size.
- `country = 'us'` The country code for the search API.
- `highWaterMark` `Number` Passed to `stream.Readable` constructor.
- `hostname = 'itunes.apple.com'` The host name of the store.
- `max` = 500 Number of in-memory non-result terms.
- `media = 'all'` The media type to search for.
- `objectMode = false` Whether this stream should behave as a stream of objects.
- `port = 80` The port to access the store.
- `result` `result()`
- `ttl = 24 * 3600 * 1000` Time in milliseconds before cached items go stale.

## Exports

The **fanboy** module exports the `Fanboy` class, a stateful cache object with a persistent [LevelDB](https://github.com/Level/leveldown/) cache and some additional in-memory caching. To access the `Fanboy` class `require('fanboy')`. **fanboy** streams do not validate or modify search terms written to them. Be aware that term validation is expected to be dealt with upstream. The streams in this package are designed for flowing mode. They work best if you consume their data quickly. Experiment with low `highWaterMark` values, but note it may affect outward request processing. All data gets streamed.

### Creating a new cache

`Fanboy(name, opts)`

- `name` `String` The name of the file system directory for the database.
- `opts` `opts()` Optional parameters of the cache.

```js
const { Fanboy } = require('fanboy')

const cache = new Fanboy('/tmp/fanboy.db', {
  media: 'podcast'
})
```

### Searching the cache

```js
const search = cache.search()
search.end('invisible')
search.pipe(process.stdout)
```

Try running this with something like:

```
$ node example/search | json -ga collectionId
```

This will search remotely and cache the result. Until the term expires, subsequent requests hit the cache.

### Looking up a guid

```js
const lookup = cache.lookup()
lookup.end('471418144')
lookup.pipe(process.stdout)
```

You can run this with:

```
$ node example/lookup | json
```

### Obtaining suggestions for search terms

```js
const suggest = cache.suggest()
suggest.end('m')
suggest.pipe(process.stdout)
```

Try:

```
$ node example/suggest | json
```

If you have not searched before doing this, you will not get any results, because the suggestions index is populated as we are caching data. Pass a `Number` to limit the number of suggestions retrieved.

### Limits

The **default limit** of items emitted per term through this API is **50**.

## Installation

With [npm](https://npmjs.org/package/fanboy), do:

```
$ npm install fanboy
```

## License

[MIT License](https://github.com/michaelnisi/fanboy/blob/master/LICENSE)
