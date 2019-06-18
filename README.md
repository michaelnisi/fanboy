[![Build Status](https://secure.travis-ci.org/michaelnisi/fanboy.svg)](http://travis-ci.org/michaelnisi/fanboy)
[![Coverage Status](https://coveralls.io/repos/github/michaelnisi/fanboy/badge.svg?branch=master)](https://coveralls.io/github/michaelnisi/fanboy?branch=master)

# fanboy

The **fanboy** [Node.js](http://nodejs.org/) package implements proxy caching for a subset of the [iTunes Search API](https://www.apple.com/itunes/affiliates/resources/documentation/itunes-store-web-service-search-api.html).

## Types

### void()

`null` or `undefined`.

### result(obj)

A map or filter callback applied with each JSON result `obj`.

- `obj` The original, JSON parsed, [iTunes search result](https://www.apple.com/itunes/affiliates/resources/documentation/itunes-store-web-service-search-api.html#understand) object.

Returns result or `void()`.

The default callback adds the required `guid` property to `obj` and returns it.

### database()

A [Level](https://github.com/Level/) database.

### opts()

The options for the **fanboy** cache:

- `cacheSize = 1024 * 1024 * 8` The *leveldown* in-memory LRU cache size.
- `country = 'us'` The country code for the search API.
- `hostname = 'itunes.apple.com'` The host name of the store.
- `max` = 500 Number of in-memory non-result terms.
- `media = 'all'` The media type to search for.
- `objectMode = false` Whether this stream should behave as a stream of objects.
- `port = 80` The port to access the store.
- `result` `result()`
- `ttl = 24 * 3600 * 1000` Time in milliseconds before cached items go stale.

## Exports

The **fanboy** module exports the `Fanboy` class, a stateful cache object with a persistent [Level](https://github.com/Level/) cache and some additional in-memory caching. To access the `Fanboy` class `require('fanboy')`.

### Creating a new cache

`Fanboy(db, opts)`

- `db` `database()` The name of the file system directory for the database.
- `opts` `opts()` Optional parameters of the cache.

```js
const { Fanboy } = require('./')
const { createDatabase } = require('./lib/level')
const { defaults } = require('./lib/init')

function createCache (custom = { media: 'podcast' }) {
  const location = '/tmp/fanboy-repl'
  const opts = defaults(custom)
  const db = createDatabase(location)

  return new Fanboy(db, opts)
}

const fanboy = createCache()
```

### Searching the cache

```js
fanboy.search(term, (error, items) => {
  if (error) {
    return console.error(error)
  }

  for (let item of items) {
    console.log(item))
  }
})
```

This will search remotely and cache the result. Until the term expires, subsequent requests hit the cache.

### Looking up a guid

```js
fanboy.lookup(guid, (error, item) => {
  if (error) {
    return console.error(error)
  }

  console.log(item))
})
```

### Obtaining suggestions for search terms

```js
fanboy.suggest(term, limit, (error, terms) => {
  if (error) {
    return console.error(error)
  }

  for (let term of terms) {
    console.log(term))
  }
})
```

If you have not searched before doing this, you will not get any results, because the suggestions index is populated as we are caching data. Pass a `Number` to limit the number of suggestions retrieved.

## REPL

Try those examples in the REPL.

```
$ ./repl
```

### Limits

By the default the number of result items per term is limited to **50**.

## Installation

With [npm](https://npmjs.org/package/fanboy), do:

```
$ npm install fanboy
```

## License

[MIT License](https://github.com/michaelnisi/fanboy/blob/master/LICENSE)
