import EventEmitter from 'node:events'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { bootstrap } from '@libp2p/bootstrap'
import { noise } from '@chainsafe/libp2p-noise'
import { mdns } from '@libp2p/mdns'
import { yamux } from '@chainsafe/libp2p-yamux'
import { peerIdFromString } from '@libp2p/peer-id'
import { pipe } from 'it-pipe'
// import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import { createLibp2p, Libp2p } from 'libp2p'
import { identify } from '@libp2p/identify'
import { ping } from '@libp2p/ping'
import { dcutr } from '@libp2p/dcutr'
import { kadDHT, passthroughMapper } from '@libp2p/kad-dht'

import { Transform } from 'stream'

import is_ip_private from 'private-ip'
import ip from 'ip'
import { type Multiaddr, multiaddr } from '@multiformats/multiaddr'

import { OceanNodeConfig, OceanNodeKeys, P2PCommandResponse } from '../@types/p2p'
import { NodeIpAndDns, NodeCheckResult } from './@types/monitor'
import { defaultBootstrapAddresses } from './const.js'
import { extractPublicIp } from './utils.js'

EventEmitter.defaultMaxListeners = 500

export class OceanP2P extends EventEmitter {
  _libp2p: any
  _topic: string
  _options: any
  _peers: any[]
  _connections: {}
  _protocol: string
  _publicAddress: string
  _publicKey: Uint8Array
  _privateKey: Uint8Array
  _analyzeRemoteResponse: Transform
  _pendingAdvertise: string[] = []
  _config: OceanNodeConfig
  constructor() {
    super()
  }

  async start(options: any = null) {
    this._topic = 'oceanprotocol'
    this._config = {
      keys: await getPeerIdFromPrivateKey(process.env.PRIVATE_KEY),
      p2pConfig: {
        bootstrapNodes: defaultBootstrapAddresses,
        enableIPV4: true,
        enableIPV6: false,
        ipV4BindAddress: '0.0.0.0',
        ipV4BindTcpPort: 0,
        ipV4BindWsPort: 9001,
        ipV6BindAddress: '::1',
        ipV6BindTcpPort: 9002,
        ipV6BindWsPort: 9003,
        announceAddresses: [],
        pubsubPeerDiscoveryInterval: 3000,
        dhtMaxInboundStreams: 500,
        dhtMaxOutboundStreams: 500,
        mDNSInterval: 20e3,
        connectionsMaxParallelDials: 100 * 25,
        connectionsDialTimeout: 30e3,
        upnp: false,
        autoNat: false,
        enableCircuitRelayServer: false,
        enableCircuitRelayClient: false,
        circuitRelays: 0,
        announcePrivateIp: false,
        filterAnnouncedAddresses: ['172.15.0.0/24'],
        minConnections: 2,
        maxConnections: 6000,
        autoDialPeerRetryThreshold: 1000 * 120,
        autoDialConcurrency: 500,
        maxPeerAddrsToDial: 25,
        autoDialInterval: 5000
      }
    }
    this._libp2p = await this.createNode(this._config)
    this._options = options
    this._peers = []
    this._connections = {}
    this._protocol = '/ocean/nodes/1.0.0'

    this._analyzeRemoteResponse = new Transform({
      transform(chunk, encoding, callback) {
        callback(null, chunk.toString().toUpperCase())
      }
    })
  }

  shouldAnnounce(addr: any) {
    try {
      const maddr = multiaddr(addr)
      // always filter loopback
      if (ip.isLoopback(maddr.nodeAddress().address)) {
        return false
      }
      // check filters
      for (const filter of this._config.p2pConfig.filterAnnouncedAddresses) {
        if (ip.cidrSubnet(filter).contains(maddr.nodeAddress().address)) {
          return false
        }
      }
      if (
        this._config.p2pConfig.announcePrivateIp === false &&
        (is_ip_private(maddr.nodeAddress().address) ||
          ip.isPrivate(maddr.nodeAddress().address))
      ) {
        // disabled logs because of flooding
        // P2P_LOGGER.debug(
        //  'Deny announcement of private address ' + maddr.nodeAddress().address
        // )
        return false
      } else {
        // disabled logs because of flooding
        // P2P_LOGGER.debug('Allow announcement of ' + maddr.nodeAddress().address)
        return true
      }
    } catch (e) {
      // we reach this part when having circuit relay. this is fine
      return true
    }
  }

  async createNode(config: OceanNodeConfig): Promise<Libp2p | null> {
    try {
      this._publicAddress = config.keys.peerId.toString()
      this._publicKey = config.keys.publicKey
      this._privateKey = config.keys.privateKey
      /** @type {import('libp2p').Libp2pOptions} */
      // start with some default, overwrite based on config later
      const servicesConfig = {
        identify: identify(),
        dht: kadDHT({
          // this is necessary because this node is not connected to the public network
          // it can be removed if, for example bootstrappers are configured
          allowQueryWithZeroPeers: true,
          maxInboundStreams: config.p2pConfig.dhtMaxInboundStreams,
          maxOutboundStreams: config.p2pConfig.dhtMaxOutboundStreams,
          pingTimeout: 1300,
          pingConcurrency: 20,
          clientMode: false, // this should be true for edge devices
          kBucketSize: 20,
          protocol: '/ocean/nodes/1.0.0/kad/1.0.0',
          peerInfoMapper: passthroughMapper
          // protocolPrefix: '/ocean/nodes/1.0.0'
          // randomWalk: {
          //  enabled: true,            // Allows to disable discovery (enabled by default)
          //  interval: 300e3,
          //  timeout: 10e3
          // }
        }),
        ping: ping(),
        dcutr: dcutr()
      }
      const bindInterfaces = []
      if (config.p2pConfig.enableIPV4) {
        bindInterfaces.push(
          `/ip4/${config.p2pConfig.ipV4BindAddress}/tcp/${config.p2pConfig.ipV4BindTcpPort}`
        )
        bindInterfaces.push(
          `/ip4/${config.p2pConfig.ipV4BindAddress}/tcp/${config.p2pConfig.ipV4BindWsPort}/ws`
        )
      }
      if (config.p2pConfig.enableIPV6) {
        bindInterfaces.push(
          `/ip6/${config.p2pConfig.ipV6BindAddress}/tcp/${config.p2pConfig.ipV6BindTcpPort}`
        )
        bindInterfaces.push(
          `/ip6/${config.p2pConfig.ipV6BindAddress}/tcp/${config.p2pConfig.ipV6BindWsPort}/ws`
        )
      }
      // const transports = [webSockets(), tcp()]
      const transports = [
        webSockets(),
        tcp(),
        circuitRelayTransport({
          discoverRelays: 0
        })
      ]

      let addresses = {}
      if (
        config.p2pConfig.announceAddresses &&
        config.p2pConfig.announceAddresses.length > 0
      ) {
        addresses = {
          listen: bindInterfaces,
          announceFilter: (multiaddrs: any[]) =>
            multiaddrs.filter((m) => this.shouldAnnounce(m)),
          announce: config.p2pConfig.announceAddresses
        }
      } else {
        addresses = {
          listen: bindInterfaces,
          announceFilter: (multiaddrs: any[]) =>
            multiaddrs.filter((m) => this.shouldAnnounce(m))
        }
      }
      let options = {
        addresses,
        peerId: config.keys.peerId,
        transports,
        streamMuxers: [yamux()],
        connectionEncryption: [
          noise()
          // plaintext()
        ],
        services: servicesConfig,
        connectionManager: {
          maxParallelDials: config.p2pConfig.connectionsMaxParallelDials, // 150 total parallel multiaddr dials
          dialTimeout: config.p2pConfig.connectionsDialTimeout, // 10 second dial timeout per peer dial
          minConnections: config.p2pConfig.minConnections,
          maxConnections: config.p2pConfig.maxConnections,
          autoDialPeerRetryThreshold: config.p2pConfig.autoDialPeerRetryThreshold,
          autoDialConcurrency: config.p2pConfig.autoDialConcurrency,
          maxPeerAddrsToDial: config.p2pConfig.maxPeerAddrsToDial,
          autoDialInterval: config.p2pConfig.autoDialInterval
        }
      }
      if (config.p2pConfig.bootstrapNodes && config.p2pConfig.bootstrapNodes.length > 0) {
        options = {
          ...options,
          ...{
            peerDiscovery: [
              bootstrap({
                list: config.p2pConfig.bootstrapNodes,
                timeout: 20000, // in ms,
                tagName: 'bootstrap',
                tagValue: 50,
                tagTTL: 120000
              }),
              mdns({
                interval: config.p2pConfig.mDNSInterval
              })
            ]
          }
        }
      } else {
        // only mdns & pubsubPeerDiscovery
        options = {
          ...options,
          ...{
            peerDiscovery: [
              mdns({
                interval: config.p2pConfig.mDNSInterval
              })
            ]
          }
        }
      }
      const node = await createLibp2p(options)
      await node.start()

      return node
    } catch (e) {}
    return null
  }

  async getAllPeerStore() {
    const s = await this._libp2p.peerStore.all()
    return s
    // for await (const peer of this._libp2p.peerRouting.getClosestPeers(s[0].id.toString())) {
    //  console.log(peer.id, peer.multiaddrs)
    // }
  }

  async getNetworkingStats() {
    const ret: any = {}
    ret.binds = await this._libp2p.components.addressManager.getListenAddrs()
    ret.listen = await this._libp2p.components.transportManager.getAddrs()
    ret.observing = await this._libp2p.components.addressManager.getObservedAddrs()
    ret.announce = await this._libp2p.components.addressManager.getAnnounceAddrs()
    ret.connections = await this._libp2p.getConnections()
    return ret
  }

  async getRunningOceanPeers() {
    return await this.getOceanPeers(true, false)
  }

  async getKnownOceanPeers() {
    return await this.getOceanPeers(false, true)
  }

  async getAllOceanPeers() {
    return await this.getOceanPeers(true, true)
  }

  async getOceanPeers(running: boolean = true, known: boolean = true) {
    const peers: string[] = []
    try {
      if (known) {
        // get p2p peers and filter them by protocol
        for (const peer of await this._libp2p.peerStore.all()) {
          if (!peers.includes(peer.id.toString())) {
            peers.push(peer.id.toString())
          }
        }
      }
    } catch (e) {
      console.error(e)
    }
    return peers
  }

  async hasPeer(peer: any) {
    const s = await this._libp2p.peerStore.all()
    return Boolean(s.find((p: any) => p.toString() === peer.toString()))
  }

  async sendTo(
    multiaddrs: Multiaddr[],
    message: string,
    sink: any
  ): Promise<P2PCommandResponse> {
    const maxRetries = process.env.DIAL_PROTOCOL_RETRIES
      ? parseInt(process.env.DIAL_PROTOCOL_RETRIES)
      : 2

    let stream
    let attempt = 0
    const response: P2PCommandResponse = {
      status: { httpStatus: 200, error: '' },
      stream: null
    }
    while (attempt < maxRetries) {
      try {
        attempt += 1
        stream = await this._libp2p.dialProtocol(multiaddrs, this._protocol, {
          signal: AbortSignal.timeout(3000),
          priority: 100,
          runOnTransientConnection: true
        })
      } catch (e) {
        if (attempt >= maxRetries) {
          response.status.httpStatus = 404
          response.status.error = e.message
            ? `Cannot connect to peer(${e.message})`
            : 'Cannot connect to peer'
          return response
        }
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    if (stream) {
      response.stream = stream
      try {
        await pipe(
          // Source data
          [uint8ArrayFromString(message)],
          // Write to the stream, and pass its output to the next function
          stream,
          // this is the anayze function
          // doubler as any,
          // Sink function
          sink
        )
      } catch (err) {
        // console.log(`Unable to send P2P message: ${err.message}`)
        response.status.httpStatus = 404
        response.status.error = err.message
      }
    } else {
      response.status.httpStatus = 404
      response.status.error = 'Unable to get remote P2P stream (null)'
      // console.log(response.status.error)
    }

    return response
  }

  /**
   * Is the message intended for this peer or we need to connect to another one?
   * @param targetPeerID  the target node id
   * @returns true if the message is intended for this peer, false otherwise
   */
  isTargetPeerSelf(targetPeerID: string): boolean {
    return targetPeerID === this.getPeerId()
  }

  getPeerId(): string {
    return this._config.keys.peerId.toString()
  }

  async checkPeer(peer: string, addrs: any, deltaTime: number): Promise<NodeCheckResult> {
    let peerId = null
    let success = false
    let errorCause
    let ipAddrs: NodeIpAndDns = {
      ip: null,
      dns: null,
      port: 0,
      relay: false,
      relayNode: null
    }
    let status: any
    // console.log('Start checking ' + peer)

    try {
      peerId = peerIdFromString(peer)
    } catch (e) {
      errorCause = 'Invalid peer'
    }
    let peerData = null
    const multiaddrs: Multiaddr[] = []
    // we need to take peerData
    // search peerStore and dht only if we don't have addresses
    if (addrs.length < 1) {
      // first from our peerStore, maybe we are already connected
      // then we must fetch additional multiaddrs from DHT
      try {
        // console.log('Search peer store')
        peerData = await this._libp2p.peerStore.get(peerId, {
          signal: AbortSignal.timeout(2000)
        })
        if (peerData) {
          for (const x of peerData.addresses) {
            multiaddrs.push(x.multiaddr)
          }
        }
      } catch (e) {
        // console.log(e)
      }
      try {
        // console.log('Search dht')
        peerData = await this._libp2p.peerRouting.findPeer(peerId, {
          signal: AbortSignal.timeout(5000),
          useCache: false
        })
        if (peerData) {
          for (const index in peerData.multiaddrs) {
            multiaddrs.push(peerData.multiaddrs[index])
          }
        }
      } catch (e) {
        // console.log(e)
      }
    } else {
      for (const x of addrs) {
        multiaddrs.push(x)
      }
    }
    // now we should have peer multiaddrs
    if (multiaddrs.length < 1) {
      errorCause = 'No peer data'
      peerId = null
    } else {
      ipAddrs = await extractPublicIp(multiaddrs)
      if (ipAddrs.ip == null && ipAddrs.relay === false) {
        errorCause = 'No public IP'
        peerId = null
      }
    }
    if (peerId) {
      let chunks: string = ''
      const sink = async function (source: any) {
        let first = true
        for await (const chunk of source) {
          if (first) {
            first = false
            try {
              const str = uint8ArrayToString(chunk.subarray()) // Obs: we need to specify the length of the subarrays
              const decoded = JSON.parse(str)
            } catch (e) {
              console.log(e)
            }
          } else {
            const str = uint8ArrayToString(chunk.subarray())
            chunks = chunks.concat(str)
            return str
          }
        }
      }
      // when dialing a peer using multiaddrs, we need to make that
      //    all multiaddrs have peerID
      //          or
      //    none of the multiaddrs have peerID
      let finalmultiaddrs: Multiaddr[] = []
      const finalmultiaddrsWithAddress: Multiaddr[] = []
      const finalmultiaddrsWithOutAddress: Multiaddr[] = []
      for (const x of multiaddrs) {
        if (x.toString().includes(peer)) {
          try {
            finalmultiaddrsWithAddress.push(multiaddr(x.toString()))
          } catch (e) {
            //
          }
        } else {
          let sd = x.toString()
          if (x.toString().includes('p2p-circuit')) {
            sd = sd + '/p2p/' + peerId
          }
          try {
            finalmultiaddrsWithOutAddress.push(multiaddr(sd))
          } catch (e) {
            //
          }
        }
      }
      if (finalmultiaddrsWithAddress.length > finalmultiaddrsWithOutAddress.length) {
        finalmultiaddrs = finalmultiaddrsWithAddress
      } else {
        finalmultiaddrs = finalmultiaddrsWithOutAddress
      }
      const tr = await this.sendTo(
        finalmultiaddrs,
        JSON.stringify({
          command: 'status',
          node: peerId
        }),
        sink
      )
      // console.log(tr)
      if (tr.status.httpStatus === 200) {
        status = chunks
        success = true
      } else {
        errorCause = tr.status.error
      }
    }
    // if (!success) {
    //   // at least get status
    //   status = await getNodeStatusFromOPF(peer)
    // }
    // return await updateNodeStatus(peer, ipAddrs, success, errorCause, status, deltaTime)
    if (success) {
      console.log('Eligible     ' + peer + ':  IPs:' + JSON.stringify(ipAddrs))
    } else {
      console.log(
        'Not eligible ' +
          peer +
          ':  IPs:' +
          JSON.stringify(ipAddrs) +
          '  cause:' +
          errorCause
      )
    }
    return { peerId: peer, ipAddrs, success, errorCause, status, deltaTime }
  }
}
