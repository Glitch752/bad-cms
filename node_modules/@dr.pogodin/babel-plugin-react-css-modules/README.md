# Babel Plugin: React CSS Modules

![Master Build Status](https://img.shields.io/circleci/project/github/birdofpreyru/babel-plugin-react-css-modules/master.svg?label=master)
![Dev Build Status](https://img.shields.io/circleci/project/github/birdofpreyru/babel-plugin-react-css-modules/devel.svg?label=devel)
![Latest NPM Release](https://img.shields.io/npm/v/@dr.pogodin/babel-plugin-react-css-modules.svg)
![NPM Downloads](https://img.shields.io/npm/dm/@dr.pogodin/babel-plugin-react-css-modules.svg)

This [Babel] plugin for [React] transforms `styleName` attribute of
JSX components into `className` using compile-time [CSS Modules] resolution,
allowing for a cleaner use of CSS Modules in React.

## Content

- [Usage examples](#usage-examples)
- [Installation](#installation)
  - [React Native](#react-native)
- [Configuration](#configuration)
  - [Plugin options](#plugin-options)
  - [Configurate syntax loaders]
  - [Custom Attribute Mapping]
- [Under the hood](#under-the-hood)
  - [How does it work?](#how-does-it-work)
  - [Project history](#project-history)
  - [Migration from `babel-plugin-react-css-modules`](##migration-from-babel-plugin-react-css-modules)
  - [`css-loader` compatibility](#css-loader-compatibility)

## Usage Examples

Assuming `style.css` in the following examples is compiled as CSS Module.

**Without this plugin**
```jsx
import S from './styles.css';

export default function Component() {
  return (
    <div className={S.container}>
      <h1 className={S.title}>Example</div>
      <p styleName={S.text}>Sample text paragraph.</p>
      <p className={`${S.text} ${S.special}`}>
        Sample text paragraph with special style.
      </p>
    </div>
  );
}
```

**With this plugin**
```jsx
import './styles.css';

export default function Component() {
  return (
    <div styleName="container">
      <h1 styleName="title">Example</div>
      <p styleName="text">Sample text paragraph.</p>
      <p styleName="text special">
        Sample text paragraph with special style.
      </p>
    </div>
  );
}
```

**With this plugin and multiple stylesheets**

Assuming:
- Styles `container`, `title`, and `text` are defined in `styles-01.css`.
- Style `special` is defined in `styles-02.css`.
- The plugin's `autoResolveMultipleImports` option is enabled (default).

```jsx
import './styles-01.css';
import './styles-02.css';

export default function Component() {
  return (
    <div styleName="container">
      <h1 styleName="title">Example</div>
      <p styleName="text">Sample text paragraph.</p>
      <p styleName="text special">
        Sample text paragraph with special style.
      </p>
    </div>
  );
}
```
If both files, `styles-01.css` and `styles-02.css` contain styles with the same
names, thus making auto resolution impossible, this plugin allows explicit
stylesheet prefixes:
```jsx
import S1 from './styles-01.css';
import S2 from './styles-02.css';

export default function Component() {
  return (
    <div styleName="S1.container">
      <h1 styleName="S1.title">Example</div>
      <p styleName="S1.text">Sample text paragraph.</p>
      <p styleName="S1.text S2.special">
        Sample text paragraph with special style.
      </p>
    </div>
  );
}
```

**With this plugin and runtime resolution**

```jsx
import './styles-01.css';
import './styles-02.css';

export default function Component({ special }) {
  let textStyle = 'text';
  if (special) textStyle += ' special';

  return (
    <div styleName="container">
      <h1 styleName="title">Example</div>
      <p styleName={textStyle}>Sample text paragraph.</p>
      <p styleName={textStyle}>
        Sample text paragraph with special style.
      </p>
    </div>
  );
}
```
In the case when the exact style value is not known at the compile time, like in
this example, the plugin will inject necessary code to correctly resolve the
`styleName` at runtime (which is somewhat less performant, but otherwise works
fine).

## Installation

- The core CSS Modules functionality should be enabled and configured elsewhere
  in your React project:
  - With [Create React App] see
    [Adding a CSS Modules Stylesheet](https://create-react-app.dev/docs/adding-a-css-modules-stylesheet).
  - With bare [Webpack] see
    [`modules` option of `css-loader`](https://webpack.js.org/loaders/css-loader/#modules).
  - With other frameworks refer to their documentation.

- Install this plugin as a direct dependency (in edge-cases not allowing for
  a compile-time `styleName` resolution, the plugin falls back to the runtime
  resolution).
  ```
  npm install --save @dr.pogodin/babel-plugin-react-css-modules
  ```

- Install Webpack at least as a dev dependency:
  ```
  npm install --save-dev webpack
  ```

- Add the plugin to Babel configuration:
  ```js
  {
    "plugins": [
      ["@dr.pogodin/react-css-modules", {
        // The default localIdentName in "css-loader" is "[hash:base64]",
        // it is highly-recommended to explicitly specify the same value
        // both here, and in "css-loader" options, including the hash length
        // (the last digit in the template below).
        "generateScopedName": "[hash:base64:6]"

        // See below for all valid options.
      }]
    ]
  }
  ```

- The `generateScopedName` option value MUST match `localIdentName` option of
  `css-loader` to ensure both Webpack and this plugin generate matching class
  names. The same goes for other options impacting class names
  (_e.g._ the default length of hashes generated by Webpack, which is used
  if you don't specify the hash length explicitly in `localIdentName` hash
  placeholders), and also the actuals version of this plugin and `css-loader`
  (see [`css-loader` compatibility]).

- _Optional_. `css-loader` is known for eventual minor updates in their default
  class name generation logic that require counterpart upgrades of this plugin
  to keep it compatible.
  [They denied](https://github.com/webpack-contrib/css-loader/issues/1152)
  to expose the default class name generator for re-used by 3rd party libraries,
  and suggested to rely on
  [`getLocalIdent`](https://webpack.js.org/loaders/css-loader/#getlocalident])
  option if unwanted class name changes due to `css-loader` updates are
  a problem for a particular project.

  To alleviate this issue, this plugin provides stable default implementation
  for `getLocalIdent` function (taken from a selected earlier version of
  `css-loader`). Consider to use it:

  **Within Webpack Config**
  ```js
  const { getLocalIdent } = require('@dr.pogodin/babel-plugin-react-css-modules/utils');

  const cssLoaderOptions = {
    modules: {
      getLocalIdent,
      localIdentName: '[path]___[name]__[local]___[hash:base64:6]'
    }
  };
  ```

  **Within Babel Config**
  ```js
  const { generateScopedNameFactory } = require('@dr.pogodin/babel-plugin-react-css-modules/utils');

  module.exports = {
    plugins: [
      ["@dr.pogodin/react-css-modules", {
        generateScopedName:
          // The classname template MUST match "localIdentName" option value
          // you passed to "css-loader".
          generateScopedNameFactory("[path]___[name]__[local]___[hash:base64:6]"),
      }]
    ]
  };
  ```

  In addition to the standard class name template placeholders mentioned in
  [`css-loader` documentation](https://webpack.js.org/loaders/css-loader/#localidentname)
  the version of `getLocalIdent()` and `generateScopedName()` provided by this
  plugin also support `[package]` placeholder. If used, it looks up from CSS
  file for the closest `package.json` file, takes the package name from it,
  and inserts it into the class name (this is useful for CSS bundling for
  libraries).

### React Native

If you'd like to get this working in React Native, you're going to have to allow
custom import extensions, via a `rn-cli.config.js` file:

```js
module.exports = {
  getAssetExts() {
    return ["scss"];
  }
}
```

Remember, also, that the bundler caches things like plugins and presets. If you
want to change your `.babelrc` (to add this plugin) then you'll want to add the
`--reset-cache` flag to the end of the package command.

## Configuration

### Plugin Options

These are valid plugin options. All are optional, but the overall configuration
should be compatible with that of `css-loader`, thus defaults may not work for
you.

- `context` - **string** - Must match webpack
  [`context`](https://webpack.js.org/configuration/entry-context/#context)
  configuration. `css-loader` inherits `context` values from webpack. Other CSS
  module implementations might use different context resolution logic.
  Defaults `process.cwd()`.
- `exclude` - **string** - A RegExp that will exclude otherwise included files
  _e.g._, to exclude all styles from node_modules: `exclude: 'node_modules'`.
- `filetypes` - [Configurate syntax loaders] like sugarss, LESS and SCSS,
  and extra plugins for them.
- `generateScopedName` - **function | string** - Allows to customize the exact
  `styleName` to `className` conversion algorithm. For details see
  [Generating scoped names](https://github.com/css-modules/postcss-modules#generating-scoped-names).
  Defaults `[path]___[name]__[local]___[hash:base64:5]`.
- `removeImport` - **boolean** - Remove the matching style import.
  This option is used to enable server-side rendering. Defaults **false**.
- `webpackHotModuleReloading` - **boolean** - Enables hot reloading of CSS
  in webpack. Defaults **false**.
- `handleMissingStyleName` - **string** - Determines what should be done for
  undefined CSS modules (using a `styleName` for which there is no CSS module
  defined). Valid values: `"throw"`, `"warn"`, `"ignore"`. Setting this option
  to `"ignore"` is equivalent to setting `errorWhenNotFound: false` in
  [react-css-modules](https://github.com/birdofpreyru/react-css-modules#errorwhennotfound). Defaults `"throw"`.
- `attributeNames` - [Custom Attribute Mapping]
- `skip` - **boolean** - Whether to apply plugin if no matching `attributeNames`
  found in the file. Defaults **false**.
- `autoResolveMultipleImports` - **boolean** Allow multiple anonymous imports if
  `styleName` is only in one of them. Defaults **true**.

### Configurate syntax loaders

To add support for different CSS syntaxes (e.g. SCSS), perform the following
two steps:

1.  Add the [postcss syntax loader](https://github.com/postcss/postcss#syntaxes)
    as a development dependency:

    ```bash
    npm install postcss-scss --save-dev
    ```

2.  Add a `filetypes` syntax mapping to the Babel plugin configuration.
    For example for SCSS:

    ```json
    "filetypes": {
      ".scss": {
        "syntax": "postcss-scss"
      }
    }
    ```

    And optionally specify extra plugins:

    ```json
    "filetypes": {
      ".scss": {
        "syntax": "postcss-scss",
        "plugins": [
          "postcss-nested"
        ]
      }
    }
    ```

    > NOTE: [`postcss-nested`](https://github.com/postcss/postcss-nested)
      is added as an extra plugin for demonstration purposes only. It's not
      needed with [`postcss-scss`](https://github.com/postcss/postcss-scss)
      because SCSS already supports nesting.

    Postcss plugins can have options specified by wrapping the name and an options object in an array inside your config: 

    ```json
      "plugins": [
        ["postcss-import-sync2", {
          "path": ["src/styles", "shared/styles"]
        }],
        "postcss-nested"
      ]
    ```

### Custom Attribute Mapping

You can set your own attribute mapping rules using the `attributeNames` option.

It's an object, where keys are source attribute names and values are destination
attribute names.

For example, the
[&lt;NavLink&gt;](https://github.com/ReactTraining/react-router/blob/master/packages/react-router-dom/docs/api/NavLink.md)
component from [React Router](https://github.com/ReactTraining/react-router)
has an `activeClassName` attribute to accept an additional class name. You can
set `"attributeNames": { "activeStyleName": "activeClassName" }` to transform it.

The default `styleName` -> `className` transformation **will not** be affected
by an `attributeNames` value without a `styleName` key. Of course you can use
`{ "styleName": "somethingOther" }` to change it, or use `{ "styleName": null }`
to disable it.

## Under the hood

### How does it work?

This plugin does the following:
1.  Builds index of all stylesheet imports per file (imports of files with
    `.css` or `.scss` extension).
2.  Uses [postcss](https://github.com/postcss/postcss) to parse the matching
    CSS files into a lookup of CSS module references.
3.  Iterates through all
    [JSX](https://facebook.github.io/react/docs/jsx-in-depth.html)
    element declarations.
4.  Parses the `styleName` attribute value into anonymous and named CSS module
    references.
5.  Finds the CSS class name matching the CSS module reference:
    * If `styleName` value is a string literal, generates a string literal value.
    * If `styleName` value is a
      [`jSXExpressionContainer`](https://babeljs.io/docs/en/next/babel-types.html#jsxexpressioncontainer),
      uses a helper function ([`getClassName`](./src/getClassName.js))
      to construct the `className` value at the runtime.
6.  Removes the `styleName` attribute from the element.
7.  Appends the resulting `className` to the existing `className` value
    (creates `className` attribute if one does not exist).

### Project history

This plugin is an up-to-date, well-maintained fork of the original
[`babel-plugin-react-css-modules`](https://www.npmjs.com/package/babel-plugin-react-css-modules):
- It generates class names matching current `css-loader` versions (see
  [`css-loader` compatibility] for details).
- All dependencies are upgraded to the latest versions.
- Follow-up maintenance and improvements are performed as necessary.

The original `babel-plugin-react-css-modules` plugin is largely abandoned by
its author since March 2019. When an year later updates of `css-loader` and
Webpack broke dependant projects, with no reaction from
`babel-plugin-react-css-modules` author on emerging issue reports in GitHub,
I ([birdofpreyru]) created this fork to ensure stability of my own projects
relying on it.

I am banned from commenting in the original project repo since I tried a little
self-promo, trying to encourage people to switch over to my fork. If you read
this, consider to spread the word to encourage more users to move to this fork.

### Migration from `babel-plugin-react-css-modules`

- Prefix plugin name in your Babel config by `@dr.pogodin/` scope, _i.e._:
  `@dr.pogodin/babel-plugin-react-css-modules` or `@dr.pogodin/react-css-moudles` instead of `babel-plugin-react-css-modules` or `react-css-modules`.

- Be sure to have `webpack` installed (it is a must-to-have peer dependency
  of this plugin starting from `v6.2.0`).

### `css-loader` compatibility

| `css-loader` versions   | this plugin versions    |
| ----------------------- | ----------------------- |
| `6.5.0` &div; `6.5.1` (latest) | `6.5.1` &div; `6.5.4` (latest)        |
| `6.4.0`                 | `6.4.0` &div; `6.4.1`   |
| `6.0.0` &div; `6.3.0`   | `6.2.1` &div; `6.3.1`   |
| `5.2.5` &div; `5.2.7`   | `6.1.1`                 |
| `5.2.4`                 | `6.1.0`                 |
| `5.1.3` &div; `5.2.3`   | `6.0.11`/`6.1.0`<sup>(1)</sup> |
| `5.0.0` &div; `5.1.2`   | `6.0.7` &div; `6.0.11`  |
| `4.2.0` &div; `4.3.0`   | `6.0.3` &div; `6.0.6`   |
| `<= 3.6.0`              | [original plugin](https://www.npmjs.com/package/babel-plugin-react-css-modules)  |

<sup>1) There might be some corner-case differences in class name transformation between these versions of `css-loader` and this plugin, but most probably they won't break compatibility for most users.</sup>

<!-- Reusable links -->

[Babel]: https://babeljs.io
[birdofpreyru]: https://github.com/birdofpreyru
[CSS Modules]: https://github.com/css-modules/css-modules
[Create React App]: https://create-react-app.dev
[React]: https://reactjs.org
[Webpack]: https://webpack.js.org

[FiletypesConfiguration]: #filetypesconfiguration
[GenerateScopedNameConfiguration]: #generatescopednameconfiguration
[Configurate syntax loaders]: #configurate-syntax-loaders
[Custom Attribute Mapping]: #custom-attribute-mapping
[`css-loader` compatibility]: #css-loader-compatibility
