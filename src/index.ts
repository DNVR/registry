import MessageNexus from '@dnvr/message-nexus'

type RegistryKey = string | number
type RegistryEntry = Array<RegistryKey>
type RegistryValue = string | number

interface RegistryEndpoint {
  _: RegistryValue
}

interface RegistryType {
  [ key: string ]: RegistryType & RegistryEndpoint
  [ key: number ]: RegistryType & RegistryEndpoint
}

const REGISTRY = '?registry'

let {
  Reflect: {
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

  return Registry
}()

interface Change {
  entry: RegistryEntry
  value: RegistryValue
}

let changeHandler: ( change: Change ) => void = function ( { entry, value } ) {
  let old = chainGet( entry.slice() )

  if ( value !== old ) {
    chainSet( entry.slice(), value )
    chainCleanup( RegistryBundle )
    commit()

    RegistryEvent.publish( entry.slice(), value, old, entry.slice() )
  }
}

const chainHandler: ProxyHandler<RegistryType> = {
  get ( target, name: keyof RegistryType ) {
    switch ( name ) {
      case 'value':
        return target._
        break

      default:
        target[ name ] = target[ name ] || { _: null }
        return new Proxy( target[ name ], chainHandler )
    }
  },
  set ( target, name: keyof RegistryType, value: string | number ) {

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

const chainGet = function ( array: RegistryEntry ): string | number {
  let current = new Proxy( RegistryBundle, chainHandler )
  while ( array.length ) {
    current = current[ array.shift() ]
  }
  // @ts-expect-error
  return current.value
}

const chainSet = function ( array: RegistryEntry, value: string | number ): void {
  let current = new Proxy( RegistryBundle, chainHandler )
  while ( array.length >= 2 ) {
    current = current[ array.shift() ]
  }
  // @ts-expect-error
  current[ array.shift() ] = value
}

const chainCleanup = function ( obj: RegistryType ) {
  void ( ownKeys( obj ) as Array<string> ).forEach( ( entry ) => {
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








let RegistryBundle: RegistryType = null

const Registry = {
  set ( array: RegistryEntry, value: RegistryValue ) {
    ready.then( () => changeHandler( { entry: array, value: value } ) )
  },
  get ( array: RegistryEntry ) {
    return chainGet( array )
  },
  watch ( array: RegistryEntry, fn: ( value: any, old: any, name: RegistryEntry ) => void ) {
    RegistryEvent.subscribe( array.slice(), fn )
    ready.then( ( Registry ) => Registry.get( array.slice() ) ).then( ( value ) => { if ( null !== value ) fn( value, null, array.slice() ) } )
  },
  unwatch ( array: RegistryEntry, fn: ( value: any, old: any, name: RegistryEntry ) => void ) {
    RegistryEvent.unsubscribe( array.slice(), fn )
  }
}

const RegistryEvent = new MessageNexus

export default Registry