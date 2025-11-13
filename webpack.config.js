const path = require('path');

module.exports = {
  entry: './src/main.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/',
  },
  experiments: {
    asyncWebAssembly: true,
  },
  resolve: {
    fallback: {
      'fs': false,
      'path': false,
      'crypto': false,
      'module': false,
    },
  },
  devServer: {
    static: {
      directory: path.join(__dirname, './'),
    },
    port: 8080,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
};
