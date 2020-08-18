import MessageNexus from '@dnvr/message-nexus'

let RegistryBundle: RegistryObjectType = null

type RegistryObjectType = {
  _?: any
  [ key: string ]: RegistryObjectType
}

type RegistryKey = string | number
type RegistryEntry = Array< RegistryKey >
type RegistryValue = string | number

const Registry = {
  set ( array: RegistryEntry, value: RegistryValue ) {
    library.port.postMessage( { type: 'change', entry: array, value: value } )
  },
  get ( array: RegistryEntry ) {
    let current = new Proxy( RegistryBundle, handler )
    while ( array.length ) {
      current = current[ array.shift() ]
    }
    return current.value
  },
  watch ( array: RegistryEntry, fn: ( value: any, old: any, name: RegistryEntry ) => void ) {
    RegistryEvent.subscribe( array.slice(), fn )
    registryReady.then( ( Registry ) => Registry.get( array.slice() ) ).then( ( value ) => { if ( null !== value ) fn( value, null, array.slice() ) } )
  },
  unwatch ( array: RegistryEntry, fn: ( value: any, old: any, name: RegistryEntry ) => void ) {
    RegistryEvent.unsubscribe( array.slice(), fn )
  },
  get ready (): Promise< typeof Registry > {
    return registryReady
  }
}

let registryResolver: ( a: any ) => void = null
let registryReady: Promise< typeof Registry > = new Promise( function ( resolve ) {
  registryResolver = resolve
})

let messageReception = function ( { data }: MessageEvent ) {
  if ( 'change' === data.type ) {
    let { entry, old, value } = data

    registrySet( entry.slice(), value )
  }
  else if ( 'setup' === data.type ) {
    RegistryBundle = data.bundle
    registryResolver( Registry )
  }
}

let library = new SharedWorker( './worker.ts', {
  type: 'module',
  name: 'RegistryHelper'
} )

library.port.addEventListener( 'message', messageReception )
library.port.start()

const handler: ProxyHandler<RegistryObjectType> = {
  get ( target, name: RegistryKey ) {
    if ( 'value' === name ) {
      return target._
    }
    else {
      return new Proxy( target[ name ] = target[ name ] || { _: null }, handler )
    }
  },
  set ( target, name: RegistryKey, value: RegistryValue ) {

    if ( '_' === name || 'value' === name || 'object' === typeof value && null !== value ) {
      return false
    }

    target[ name ] = target[ name ] || {
      _: null
    }

    target[ name ]._ = value

    return true
  }
}

async function registrySet ( array: RegistryEntry, value: RegistryValue ) {
  await Registry.ready
  var current = new Proxy( RegistryBundle, handler )
  while ( array.length >= 2 ) {
    current = current[ array.shift() ]
  }
  //@ts-expect-error
  current[ array.shift() ] = value
}

const RegistryEvent = new MessageNexus

export default Registry