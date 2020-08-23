const path = require( 'path' )
const WorkerPlugin = require( 'worker-plugin' )

module.exports = {
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.ts/i,
        loader: 'ts-loader',
        exclude: /node_modules/
      }
    ],
  },
  // plugins: [
  //   new WorkerPlugin({
  //     sharedWorker: true
  //   })
  // ],
  output: {
    filename: 'index.js',
    path: path.resolve( __dirname, 'dist' ),
  },
}