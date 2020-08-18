# Registry

A JavaScript library that simulates the Registry.

## Install

`npm install @dnvr/registry`

## Usage
```TS

import Registry from '@dnvr/registry'

Registry.set( [ 'site', 'background', 'color' ], 'black' ) // Sets the registry entry

Registry.watch( [ 'site', 'background', 'color' ], function ( value ) {
  document.body.style.backgroundColor = value
}) // Attaches a listener to the property and immediately runs callback

Registry.watch( [ 'site', 'background' ], function ( value ) {
  document.body.classList.toggle( 'dark', value === 'dark' )
}) // Attaches a listener

Registry.set( [ 'site', 'background', 'color' ], 'white' ) // Will cause the background to turn white.

Registry.set( [ 'site', 'background' ], 'dark' ) // Will cause the body element to take on the additional class of 'dark'
```