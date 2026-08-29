// webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.js', // entry point of your React app
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash].js',
    clean: true, // cleans dist folder on each build
    publicPath: '/', // important for React Router
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/, // handle both .js and .jsx
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/, // if you want to import CSS files
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i, // for images
        type: 'asset/resource',
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'], // so you can import without specifying extension
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html', // base HTML file
    }),
  ],
  devServer: {
    static: path.join(__dirname, 'dist'),
    port: 3000, // change if needed
    hot: true,
    historyApiFallback: true, // allows React Router to work
    open: true, // auto-open browser
  },
  mode: 'development',
};
