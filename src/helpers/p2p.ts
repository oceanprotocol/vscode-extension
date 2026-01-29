import { Signer } from 'ethers'
import { createLibp2p, type Libp2p } from 'libp2p'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import { bootstrap } from '@libp2p/bootstrap'
import { multiaddr } from '@multiformats/multiaddr'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { ping } from '@libp2p/ping'
import { getAuthorization } from './auth'
import { PROTOCOL_COMMANDS } from '../enum'
import { GatewayResponse } from '../types'

export const DEFAULT_MULTIADDR =
  '/ip4/198.145.104.8/tcp/9001/tls/sni/198-145-104-8.kzwfwjn5ji4puuok23h2yyzro0fe1rqv1bqzbmrjf7uqyj504rawjl4zs68mepr.libp2p.direct/ws/p2p/16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi'

export const DEFAULT_PEER_ID = '16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi'

const OCEAN_P2P_PROTOCOL = '/ocean/nodes/1.0.0'
const MAX_RETRIES = 5
const RETRY_DELAY_MS = 1000

let libp2pNode: Libp2p | null = null

async function getOrCreateLibp2pNode(): Promise<Libp2p> {
  if (libp2pNode) {
    return libp2pNode
  }

  libp2pNode = await createLibp2p({
    addresses: { listen: [] },
    transports: [webSockets(), tcp()],
    connectionEncrypters: [noise()],
    streamMuxers: [
      yamux({
        enableKeepAlive: true,
        streamOptions: {
          maxStreamWindowSize: 5 * 1024 * 1024
        }
      })
    ],
    services: {
      ping: ping()
    },
    peerDiscovery: [
      bootstrap({
        list: [DEFAULT_MULTIADDR],
        timeout: 10000
      })
    ],
    connectionManager: {
      maxConnections: 100
    }
  })
  await libp2pNode.start()

  return libp2pNode
}

function toBytes(chunk: Uint8Array | { subarray(): Uint8Array }): Uint8Array {
  return chunk instanceof Uint8Array ? chunk : chunk.subarray()
}

async function* remainingChunks(
  it: AsyncIterator<Uint8Array | { subarray(): Uint8Array }>
): AsyncGenerator<Uint8Array> {
  let next = await it.next()
  while (!next.done && next.value !== null) {
    yield toBytes(next.value)
    next = await it.next()
  }
}

export async function P2PCommand(
  command: PROTOCOL_COMMANDS,
  peerId: string,
  body: any,
  signerOrAuthToken?: Signer | string | null,
  retrialNumber: number = 0
): Promise<any> {
  try {
    const payload = {
      command,
      node: peerId,
      authorization: getAuthorization(signerOrAuthToken),
      ...body
    }

    const node = await getOrCreateLibp2pNode()
    const connection = await node.dial(multiaddr(DEFAULT_MULTIADDR))

    const stream = await connection.newStream([OCEAN_P2P_PROTOCOL])

    stream.send(uint8ArrayFromString(JSON.stringify(payload)))
    stream.close()

    const it = stream[Symbol.asyncIterator]()
    const { done, value } = await it.next()
    const firstChunk = value !== null ? toBytes(value) : null

    if (done || !firstChunk?.length) {
      throw new Error('Gateway node error: no response from peer')
    }

    const statusText = uint8ArrayToString(firstChunk)
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
      return stream
    }

    const chunks: Uint8Array[] = [firstChunk]
    for await (const c of remainingChunks(it)) {
      chunks.push(c)
    }

    let response: unknown
    for (let i = 0; i < chunks.length; i++) {
      const text = uint8ArrayToString(chunks[i])
      try {
        response = JSON.parse(text)
      } catch {
        // Not JSON, keep raw bytes
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
      return P2PCommand(command, peerId, body, signerOrAuthToken, retrialNumber + 1)
    }

    return response
  } catch (err: any) {
    throw new Error(`Gateway node error: ${err?.message ?? err}`)
  }
}
