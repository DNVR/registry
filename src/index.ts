import MessageNexus from '@dnvr/message-nexus'





const REGISTRY = '?registry'

let {
  Reflect: {
    construct,
    ownKeys,
    deleteProperty
  },
  JSON: {
    stringify
  }
} = self

let Server: Cache = null

let commit = async function () {
  await Server.put( REGISTRY, new Response( new Blob( [ stringify( RegistryBundle ) ], { type: 'application/json' } ) ) )
  return true
}

let ready = async function () {
  Server = await caches.open( 'registry-server' )

  let registry = await Server.match( REGISTRY )

  if ( registry ) {
    RegistryBundle = await registry.json()
  }
  else {
    RegistryBundle = {}
    await commit()
  }

  return true
}()

let portCollection: Set<MessagePort> = new Set

type Change = { type: string, entry: Array<string>, value: string | number }

let changeHandler: ( param: { data: Change } ) => void = function ( { data: { type, entry, value } } ) {
  let old = chainGet( entry.slice() )

  if ( value !== old ) {
    chainSet( entry.slice(), value )
    chainCleanup( RegistryBundle )
    commit()

    portCollection.forEach( inform, {
      type: 'change',
      entry,
      old,
      value
    } )
  }
}

let inform = function ( this: Change, port: MessagePort ) {
  port.postMessage( this )
}

const chainHandler: ProxyHandler<RegistryObjectType> = {
  get ( target, name: keyof RegistryObjectType ) {
    switch ( name ) {
      case 'value':
        return target._
        break

      default:
        target[ name ] = target[ name ] || { _: null }
        return new Proxy( target[ name ], chainHandler )
    }
  },
  set ( target, name: keyof RegistryObjectType, value: string | number ) {

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

const chainGet = function ( array: Array<string> ): string | number {
  let current = new Proxy( RegistryBundle, chainHandler )
  while ( array.length ) {
    current = current[ array.shift() ]
  }
  // @ts-expect-error
  return current.value
}

const chainSet = function ( array: Array<string>, value: string | number ): void {
  let current = new Proxy( RegistryBundle, chainHandler )
  while ( array.length >= 2 ) {
    current = current[ array.shift() ]
  }
  // @ts-ignore
  current[ array.shift() ] = value
}

const chainCleanup = function ( obj: RegistryObjectType ) {
  ( ownKeys( obj ) as Array<string> ).forEach( ( entry ) => {
    if ( '_' !== entry ) {
      if ( chainCleanup( obj[ entry ] ) ) {
        deleteProperty( obj, entry )
      }
    }
  } )

  if ( '_' === ownKeys( obj ).join() && null === obj._ ) {
    return true
  }
}

let addPorts = function ( port: MessagePort ) {
  portCollection.add( port )
  port.addEventListener( 'message', changeHandler )
  port.start()

  ready.then( () => {
    port.postMessage( ownKeys( port ) )
    port.postMessage( RegistryBundle )
  } )
}








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