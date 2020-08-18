/// <reference types="sharedworker" />

type RegistryObjectType = {
  _?: any
  [ key: string ]: RegistryObjectType
}

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
let Registry: RegistryObjectType = null

let RegistryBundle: {
  type: 'setup'
  bundle: RegistryObjectType
} = null

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

type Change = { type: string, entry: Array<string>, value: string | number }

let changeHandler: ( param: { data: Change } ) => void = function ( { data: { type, entry, value } } ) {
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
  let current = new Proxy( Registry, chainHandler )
  while ( array.length ) {
    current = current[ array.shift() ]
  }
  // @ts-expect-error
  return current.value
}

const chainSet = function ( array: Array<string>, value: string | number ): void {
  let current = new Proxy( Registry, chainHandler )
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

// self.addEventListener( 'connect', function ( e: MessageEvent ) {
//   let { ports } = e
//   ports.forEach( addPorts )
// } )  