import {
  RegistryKey,
  RegistryEntry,
  RegistryValue,

  RegistryType,

  Message
} from './common'

import MessageNexus from '@dnvr/message-nexus'
import RegistryWorker from 'sharedworker-loader!./registry'

let RegistryBundle: RegistryType

function forceArray ( array: RegistryKey | RegistryEntry ): RegistryEntry {
  return Array.isArray( array ) ? array.slice() : [ array ]
}

const Registry = {
  set ( entry: RegistryKey | RegistryEntry, value: RegistryValue ) {
    let array = forceArray( entry )
    library.port.postMessage( { type: 'change', entry: array, value: value } )
  },
  get ( entry: RegistryKey | RegistryEntry ) {
    let array = forceArray( entry )
    let current = new Proxy( RegistryBundle, handler )
    while ( array.length ) {
      current = current[ array.shift() as RegistryKey ]
    }
    return current.value
  },
  watch ( entry: RegistryKey | RegistryEntry, fn: ( value: any, old: any, name: RegistryEntry ) => void ) {
    let array = forceArray( entry )
    RegistryEvent.subscribe( array.slice(), fn )
    registryReady.then( ( Registry ) => Registry.get( array.slice() ) ).then( ( value ) => { if ( null !== value ) fn( value, null, array.slice() ) } )
  },
  unwatch ( entry: RegistryKey | RegistryEntry, fn: ( value: any, old: any, name: RegistryEntry ) => void ) {
    let array = forceArray( entry )
    RegistryEvent.unsubscribe( array.slice(), fn )
  },
  get ready (): Promise<typeof Registry> {
    return registryReady
  }
}

let resolver: ( value: typeof Registry ) => void
let registryReady: Promise<typeof Registry> = new Promise( function ( resolve ) {
  resolver = resolve
} )

let library = new RegistryWorker

library.port.addEventListener( 'message', function messageReception ( { data }: Message ) {
  if ( 'change' === data.type ) {
    let { entry, old, value } = data

    globalSet( entry.slice(), value )
    RegistryEvent.publish( entry.slice(), value, old, entry.slice() )
  }
  else if ( 'setup' === data.type ) {
    RegistryBundle = data.bundle
    resolver( Registry )
  }
} )

library.port.start()

const handler: ProxyHandler<RegistryType> = {
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

async function globalSet ( array: RegistryEntry, value: RegistryValue ) {
  await Registry.ready
  let current: RegistryType = new Proxy( RegistryBundle, handler )
  while ( array.length >= 2 ) {
    current = current[ array.shift() as RegistryKey ]
  }
  // @ts-ignore
  current[ array.shift() as RegistryKey ] = value
}

const RegistryEvent = new MessageNexus

export default Registry