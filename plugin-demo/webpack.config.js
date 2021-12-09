const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const MediaExtractPlugin = require('./MediaExtractPlugin')
module.exports = {
  mode: "development",
  entry: path.resolve(__dirname, './src/index.js'),
  devtool: "none",
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env'
            ]
          }
        }
      },
      {
        test: /\.(png|jpg)$/,
        use: 'file-loader',
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              sourceMap: false,
            }
          },
        ]
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin(),
    new MediaExtractPlugin(),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "./index.html")
    })
  ]
};
