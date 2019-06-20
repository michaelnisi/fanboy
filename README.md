# Fanboy

[![Build Status](https://secure.travis-ci.org/michaelnisi/fanboy.svg)](http://travis-ci.org/michaelnisi/fanboy) 💯 🐶

The Fanboy [Node.js](http://nodejs.org/) package provides a caching proxy for a subset of the [iTunes Search API](https://www.apple.com/itunes/affiliates/resources/documentation/itunes-store-web-service-search-api.html).

## Types

### void()

`null` or `undefined`.

### result(obj)

A map or filter callback applied with each JSON result `obj`.

- `obj` The original, JSON parsed, [iTunes search result](https://www.apple.com/itunes/affiliates/resources/documentation/itunes-store-web-service-search-api.html#understand) object.

Returns result or `void()`.

The default callback adds the **required** `guid` property to `obj` and returns it.

### database()

A [Level](https://github.com/Level/) database.

### opts()

The options for the Fanboy cache:

- `country = 'us'` The country code for the search API.
- `hostname = 'itunes.apple.com'` The host name of the store.
- `max` = 500 Number of in-memory non-result terms to save round-trips.
- `media = 'all'` The media type to search for.
- `port = 80` The port to access the store.
- `result` `result()`
- `ttl = 24 * 3600 * 1000` Time in milliseconds before cached items go stale.

## Exports

The main module exports the `Fanboy` class, a stateful cache object with a persistent [Level](https://github.com/Level/) cache and some additional in-memory caching. To access the `Fanboy` class `require('fanboy')`.

### Creating a new cache

`Fanboy(db, opts)`

- `db` `database()` The name of the file system directory for the database.
- `opts` `opts()` Optional parameters of the cache.

```js
const { Fanboy, createLevelDB } = require('fanboy')

function createCache (custom = { media: 'podcast' }) {
  const location = '/tmp/fanboy-repl'
  const opts = defaults(custom)
  const db = createLevelDB(location)

  return new Fanboy(db)
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

This will search remotely and cache the result. Until the `term` expires subsequent requests hit the cache.

### Looking up a guid

```js
fanboy.lookup(guid, (error, item) => {
  if (error) {
    return console.error(error)
  }

  console.log(item))
})
```

In iTunes you can lookup an item by its `guid`.

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

The suggestions index must be populated by prior searching to yield results. You can `limit` the number of suggested terms.

## REPL

![REPL](https://s3-eu-west-1.amazonaws.com/assets.codes.ink/fanboy/repl.png)

Try the REPL, its methods let you optionally select a property by name ('collectionName') for clearer output. 

```
$ ./repl
fanboy> search('wnyc', 'collectionName')
```

### Limits

By default the number of result items per term is limited to **50**.

## Installation

With [npm](https://npmjs.org/package/fanboy), do:

```
$ npm install fanboy
```

## License

[MIT License](https://github.com/michaelnisi/fanboy/blob/master/LICENSE)
