export type RegistryKey = string | number
export type RegistryEntry = Array<RegistryKey>
export type RegistryValue = string | number

export interface RegistryEndpoint {
  _: RegistryValue
}

export interface RegistryType {
  [ key: string ]: RegistryType & RegistryEndpoint
  [ key: number ]: RegistryType & RegistryEndpoint
}

export interface Change {
  entry: RegistryEntry
  value: RegistryValue
}

export interface ChangeData extends Change {
  type: 'change'
  old: RegistryValue
}

export interface ChangeMessage extends MessageEvent {
  data: ChangeData
}

export interface Setup {
  type: 'setup'
  bundle: RegistryType
}

export interface Message {
  data: ChangeData | Setup
}