declare module 'sharedworker-loader!*' {
  class ExportedSharedWorker extends SharedWorker {
    constructor ()
  }

  export default ExportedSharedWorker
}