_A fork of [`postcss-icss` Git repository](https://github.com/css-modules/postcss-icss), updated to use the latest dependency versions. The Git repo hosts codebases of both **postcss-modules-parser** (older), and **postcss-icss** (newer) NPM packages. The present fork updates and releases **postcss-modules-parser** only._

A CSS Modules parser to extract tokens from the css file. Provides opportunity to process multiple files. Supports both synchronous and asynchronous file loaders.

## API

In order to use it you should provide a `fetch` function which should load contents of files and process it with the PostCSS instance. `fetch` function should return tokens or promise object which will resolve into tokens.

```javascript
var Parser = require('@dr.pogodin/postcss-modules-parser');

/**
 * @param  {string} to   Path to the new file. Could be any.
 * @param  {string} from Path to the source file. Should be absolute.
 * @return {object}      Tokens
 */
function fetch(to, from) {
  // load content
  return instance.process(css, {from: filename}).root.tokens;
}

new Parser({fetch: fetch});
```

See the examples:
- asynchronous loader: [test/helper/async-loader.js](https://github.com/css-modules/postcss-modules-parser/blob/master/test/helper/async-loader.js)
- synchronous loader: [test/helper/sync-loader.js](https://github.com/css-modules/postcss-modules-parser/blob/master/test/helper/sync-loader.js)
