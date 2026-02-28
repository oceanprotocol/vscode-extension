import { Signer } from 'ethers'
import { createLibp2p, type Libp2p } from 'libp2p'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import { bootstrap } from '@libp2p/bootstrap'
import { lpStream, UnexpectedEOFError } from '@libp2p/utils'
import { isMultiaddr, Multiaddr, multiaddr } from '@multiformats/multiaddr'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { getAuthorization } from './auth'
import { PROTOCOL_COMMANDS } from '../enum'
import { GatewayResponse } from '../types'

const DIAL_TIMEOUT_MS = 10_000

export const DEFAULT_MULTIADDR =
  '/ip4/35.202.16.215/tcp/9001/tls/sni/35-202-16-215.kzwfwjn5ji4puuok23h2yyzro0fe1rqv1bqzbmrjf7uqyj504rawjl4zs68mepr.libp2p.direct/ws/p2p/16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi'

// export const DEFAULT_MULTIADDR =
//   '/ip4/34.107.108.64/tcp/9001/tls/sni/34-107-108-64.kzwfwjn5ji4puoabcnz7x2jwggc1d8uhhxgd6m9srts7irsa21wvbd18trgl9hc.libp2p.direct/ws/p2p/16Uiu2HAm7tJg8MXgUzxxUXi55dVL86MNsrSJiLS3EjxWRqvTTEGw'

// export const DEFAULT_MULTIADDR =
//   '/ip4/34.107.108.64/tcp/9001/tls/sni/34-107-108-64.kzwfwjn5ji4puvz8g9ljbuynsva03t3iyyf5j13k0s8ixshhuj51ih78wvgqal5.libp2p.direct/ws/p2p/16Uiu2HAmUf4JpduE6CXpNMm1xdjhFUH53G4c9o37Kat3wsreUyaQ'

export const OCEAN_P2P_PROTOCOL = '/ocean/nodes/1.0.0'
const MAX_RETRIES = 5
const RETRY_DELAY_MS = 1000

let libp2pNode: Libp2p | null = null
let lastBootstrapKey: string | null = null

function bootstrapKey(addrs: Multiaddr[]): string {
  return addrs
    .map((a) => a.toString())
    .sort()
    .join(',')
}

export async function getOrCreateLibp2pNode(
  multiaddresses: Multiaddr[]
): Promise<Libp2p> {
  const key = bootstrapKey(multiaddresses)
  if (libp2pNode && lastBootstrapKey === key) {
    return libp2pNode
  }

  console.log('Creating new libp2p node')
  libp2pNode = await createLibp2p({
    addresses: { listen: [] },
    transports: [webSockets(), tcp()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    peerDiscovery: [
      bootstrap({
        list: multiaddresses.map((addr) => addr.toString()),
        timeout: 10000
      })
    ],
    connectionManager: {
      maxConnections: 100
    },
    connectionMonitor: {
      abortConnectionOnPingFailure: false
    }
  })
  lastBootstrapKey = key
  await libp2pNode.start()

  return libp2pNode
}

function toUint8Array(chunk: Uint8Array | { subarray(): Uint8Array }): Uint8Array {
  return chunk instanceof Uint8Array ? chunk : chunk.subarray()
}

export async function P2PCommand(
  command: PROTOCOL_COMMANDS,
  multiaddresses: string[],
  body: any,
  signerOrAuthToken?: Signer | string | null,
  retrialNumber: number = 0
): Promise<any> {
  try {
    const payload = {
      command,
      authorization: getAuthorization(signerOrAuthToken),
      ...body
    }
    const multiaddressesToDial = multiaddresses
      .filter((address) => isMultiaddr(multiaddr(address)))
      .map((address) => multiaddr(address))

    const node = await getOrCreateLibp2pNode(multiaddressesToDial)
    const stream = await node.dialProtocol(multiaddressesToDial, OCEAN_P2P_PROTOCOL, {
      signal: AbortSignal.timeout(DIAL_TIMEOUT_MS)
    })
    const lp = lpStream(stream)

    await lp.write(uint8ArrayFromString(JSON.stringify(payload)), {
      signal: AbortSignal.timeout(DIAL_TIMEOUT_MS)
    })
    await stream.close()

    const firstChunk = await lp.read({
      signal: AbortSignal.timeout(DIAL_TIMEOUT_MS)
    })
    const firstBytes = toUint8Array(firstChunk)
    if (!firstBytes.length) {
      throw new Error('Gateway node error: no response from peer')
    }

    const statusText = uint8ArrayToString(firstBytes)
    try {
      const status = JSON.parse(statusText)
      if (typeof status?.httpStatus === 'number' && status.httpStatus >= 400) {
        throw new Error(status.error ?? `Gateway node error: ${status.httpStatus}`)
      }
    } catch {}

    if (
      command === PROTOCOL_COMMANDS.COMPUTE_GET_STREAMABLE_LOGS ||
      command === PROTOCOL_COMMANDS.COMPUTE_GET_RESULT
    ) {
      const streamableChunks = (async function* () {
        try {
          while (true) {
            const chunk = await lp.read({
              signal: AbortSignal.timeout(DIAL_TIMEOUT_MS)
            })
            yield toUint8Array(chunk)
          }
        } catch (e) {
          if (!(e instanceof UnexpectedEOFError)) {
            throw e
          }
        }
      })()
      return streamableChunks
    }

    const chunks: Uint8Array[] = [firstBytes]
    try {
      while (true) {
        const chunk = await lp.read({
          signal: AbortSignal.timeout(DIAL_TIMEOUT_MS)
        })
        chunks.push(toUint8Array(chunk))
      }
    } catch (e) {
      if (!(e instanceof UnexpectedEOFError)) {
        throw e
      }
    }

    let response: unknown
    for (let i = 0; i < chunks.length; i++) {
      const text = uint8ArrayToString(chunks[i])
      try {
        response = JSON.parse(text)
      } catch {
        response = chunks[i]
      }
    }

    const res = response as GatewayResponse | null
    if (typeof res?.httpStatus === 'number' && res.httpStatus >= 400) {
      throw new Error(res.error ?? 'Gateway node error')
    }

    const errText = (typeof response === 'string' ? response : res?.error) ?? ''
    if (errText.includes('Cannot connect to peer') && retrialNumber < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
      return P2PCommand(
        command,
        multiaddresses,
        body,
        signerOrAuthToken,
        retrialNumber + 1
      )
    }

    return response
  } catch (err: any) {
    throw new Error(`Gateway node error: ${err?.message ?? err}`)
  }
}
