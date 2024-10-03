export interface NodeIpAndDns {
  ip: string
  port: number
  dns: string
  relay: boolean
  relayNode: string
}

export interface NodeLocation {
  id: string
  ip: string
  country?: string
  city?: string
  lat?: number
  lon?: number
}
export interface NodeCheckResult {
  peerId: string
  ipAddrs: NodeIpAndDns
  success: boolean
  errorCause: string
  status: string
  deltaTime: number
}

export interface NodeStatus {
  id: string
  location: NodeLocation
  ipAndDns: NodeIpAndDns
  eligible: boolean
  eligibilityCauseStr: string
  uptime: number
  lastCheck: number
  address: string
  allowedAdmins: string[]
  codeHash: string
  http: boolean
  p2p: boolean
  indexer: any[]
  platform: any
  provider: any[]
  publicKey: string
  supportedStorage: any
  version: string
}

export interface GeneralStatus {
  id: number
  week: number
  totalUptime: number
  lastRun: number
}

export interface NodeWeeklyUptime {
  nodeId: string
  week: number
  address: string
  uptime: number
  lastCheck: number
}
