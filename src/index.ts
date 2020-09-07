import {
  RegistryKey,
  RegistryEntry,
  RegistryValue,

  RegistryType,

  Message
} from './common'

import MessageNexus from '@dnvr/message-nexus'
import RegistryWorker from 'sharedworker-loader!./worker'

let RegistryBundle: RegistryType

const Registry = {
  set ( array: RegistryEntry, value: RegistryValue ) {
    library.port.postMessage( { type: 'change', entry: array, value: value } )
  },
  get ( array: RegistryEntry ) {
    let current = new Proxy( RegistryBundle, handler )
    while ( array.length ) {
      current = current[ array.shift() as RegistryKey ]
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

let registryResolver: ( value: typeof Registry ) => void
let registryReady: Promise< typeof Registry > = new Promise( function ( resolve ) {
  registryResolver = resolve
})

let messageReception = function ( { data }: Message ) {
  if ( 'change' === data.type ) {
    let { entry, old, value } = data

    registrySet( entry.slice(), value )
    RegistryEvent.publish( entry.slice(), value, old, entry.slice() )
  }
  else if ( 'setup' === data.type ) {
    RegistryBundle = data.bundle
    registryResolver( Registry )
  }
}

let library = new RegistryWorker

library.port.addEventListener( 'message', messageReception )
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

async function registrySet ( array: RegistryEntry, value: RegistryValue ) {
  await Registry.ready
  var current = new Proxy( RegistryBundle, handler )
  while ( array.length >= 2 ) {
    current = current[ array.shift() as RegistryKey ]
  }
  // @ts-ignore
  current[ array.shift() as RegistryKey ] = value
}

const RegistryEvent = new MessageNexus

export default Registry