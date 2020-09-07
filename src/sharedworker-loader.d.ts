declare module 'sharedworker-loader!*' {
  class WebpackWorker extends SharedWorker {
    constructor ()
  }

  export default WebpackWorker
}