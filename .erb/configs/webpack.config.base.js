/**
 * Base webpack config used across other specific configs
 */

import path from 'path';
import webpack from 'webpack';
import { dependencies as externals } from '../../src/package.json';

const ExtractCssChunks = require('extract-css-chunks-webpack-plugin');

const { getLocalIdent } = require('@dr.pogodin/babel-plugin-react-css-modules/utils');

const cssLoaderOptions = {
  modules: {
    getLocalIdent,
    localIdentName: '[path]___[name]__[local]___[hash:base64:6]',
  },
  importLoaders: 1, // if specifying more loaders
  sourceMap: false,
};

export default {
  externals: [...Object.keys(externals || {})],

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
          },
        },
      },
      {
        test: /\.css$/i,
        use: [
          {
            loader: ExtractCssChunks.loader,
            options: { hot: true }
          },
          {
            loader: "css-loader", //generating unique classname
            options: cssLoaderOptions,
          }
        ]
      },
    ],
  },

  output: {
    path: path.join(__dirname, '../../src'),
    // https://github.com/webpack/webpack/issues/1114
    libraryTarget: 'commonjs2',
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    modules: [path.join(__dirname, '../../src'), 'node_modules'],
  },

  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
    }),
    // new ExtractCssChunks({
    //   // Options similar to the same options in webpackOptions.output
    //   // both options are optional
    //   filename: '[name].css',
    //   chunkFilename: '[id].css'
    // })
  ],
};
