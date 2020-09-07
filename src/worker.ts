/// <reference types="sharedworker" />

import {
  RegistryKey,
  RegistryEntry,
  RegistryValue,

  RegistryType,

  ChangeData,
  Setup
} from './common'

const REGISTRY = '?registry'

let {
  Reflect: {
    ownKeys,
    deleteProperty
  },
  JSON: {
    stringify
  },
  Set,
  Blob,
  Proxy,
  Response
} = self

let Server: Cache
let Registry: RegistryType

let RegistryBundle: Setup

let commit = async function () {
  await Server.put( REGISTRY, new Response( new Blob( [ stringify( Registry ) ], { type: 'application/json' } ) ) )
  return true
}

let ready = async function () {
  Server = await caches.open( 'registry-server' )

  let registry = await Server.match( REGISTRY )

  if ( registry ) {
    Registry = await registry.json()
  }
  else {
    Registry = {}
    await commit()
  }

  RegistryBundle = {
    type: 'setup',
    bundle: Registry
  }

  return true
}()

let portCollection: Set<MessagePort> = new Set

let changeHandler = function ( { data: { entry, value } }: { data: ChangeData } ) {
  let old = chainGet( entry.slice() )

  if ( value !== old ) {
    chainSet( entry.slice(), value )
    chainCleanup( Registry )
    commit()

    portCollection.forEach( inform, {
      type: 'change',
      entry,
      old,
      value
    } as ChangeData )
  }
}

let inform = function ( this: ChangeData, port: MessagePort ) {
  port.postMessage( this )
}

const chainHandler: ProxyHandler<RegistryType> = {
  get ( target, name: RegistryKey ) {
    switch ( name ) {
      case 'value':
        return target._
        break

      default:
        target[ name ] = target[ name ] || { _: null }
        return new Proxy( target[ name ], chainHandler )
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

const chainGet = function ( array: RegistryEntry ): RegistryValue {
  let current = new Proxy( Registry, chainHandler )
  while ( array.length ) {
    current = current[ array.shift() as RegistryKey ]
  }
  // @ts-ignore
  return current.value
}

const chainSet = function ( array: RegistryEntry, value: RegistryValue ): void {
  let current = new Proxy( Registry, chainHandler )
  while ( array.length >= 2 ) {
    current = current[ array.shift() as RegistryKey ]
  }
  // @ts-ignore
  current[ array.shift() as RegistryKey ] = value
}

const chainCleanup = function ( obj: RegistryType ) {
  void ( ownKeys( obj ) as Array<RegistryKey> ).forEach( ( entry ) => {
    if ( '_' !== entry ) {
      if ( chainCleanup( obj[ entry ] ) ) {
        deleteProperty( obj, entry )
      }
    }
  } )

  if ( '_' === ownKeys( obj ).join() && null === obj._ ) {
    return true
  }
  else {
    return false
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

void ( self as any ).addEventListener( 'connect', function ( e: MessageEvent ) {
  let { ports } = e
  ports.forEach( addPorts )
} )
