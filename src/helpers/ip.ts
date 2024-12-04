import is_ip_private from 'private-ip'
import ip from 'ip'
import { type Multiaddr, multiaddr } from '@multiformats/multiaddr'
import dns from 'dns'
import { NodeIpAndDns } from '../@types/monitor'

function lookupPromise(addr: string) {
  return new Promise((resolve, reject) => {
    dns.lookup(addr, (err, address) => {
      if (err) {
        reject(err)
      }
      resolve(address)
    })
  })
}

export function isPrivateIP(ip): boolean {
  const reg = /^(127\.[\d.]+|[0:]+1|localhost)$/
  const result = ip.match(reg)
  if (result !== null) {
    // is loopback address
    return true
  }
  const parts = ip.split('.')
  return (
    parts[0] === '10' ||
    (parts[0] === '172' &&
      parseInt(parts[1], 10) >= 16 &&
      parseInt(parts[1], 10) <= 31) ||
    (parts[0] === '192' && parts[1] === '168')
  )
}

// get public IP address using free service API
export async function getPublicIP(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json')
    const data = await response.json()
    if (data) {
      return data.ip
    }
  } catch (err) {
    console.error('Erro getting public IP: ', err.message)
  }

  return null
}

export async function extractPublicIp(addrs: Multiaddr[]): Promise<NodeIpAndDns> {
  const ipFound: NodeIpAndDns = {
    ip: null,
    dns: null,
    port: 0,
    relay: false,
    relayNode: null
  }

  for (const addr of addrs) {
    try {
      const maddr = multiaddr(addr)
      const protos = maddr.protos()
      if (protos.some((e) => e.name === 'p2p-circuit')) {
        // it's a relay, don't count it
        continue
      }

      for (const index in protos) {
        const proto = protos[index]
        if (proto.name === 'dns4' || proto.name === 'dns6') {
          // we have a dns, let's resolve it
          try {
            // console.log("Resolving "+maddr.nodeAddress().address)
            const resolved = await lookupPromise(maddr.nodeAddress().address as string)
            // console.log('Resolved:')
            // console.log(resolved)
            if (
              ip.isLoopback(resolved as string) ||
              is_ip_private(resolved as string) ||
              ip.isPrivate(resolved as string)
            ) {
              // console.log((resolved as string) + ' is loopback/private. carry on')
              continue
            } else {
              // console.log(
              //  'Returning ip ' + resolved + ' and dns ' + maddr.nodeAddress().address
              // )
              return {
                ip: resolved as string,
                dns: maddr.nodeAddress().address,
                port: maddr.nodeAddress().port,
                relay: false,
                relayNode: null
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }
  // we have no dns, so let's get the first public ip
  for (const addr of addrs) {
    // console.log('Trying ' + addr.multiaddr)
    try {
      const maddr = multiaddr(addr)
      const protos = maddr.protos()
      if (protos.some((e) => e.name === 'p2p-circuit')) {
        // it's a relay, don't count it
        continue
      }
      for (const index in protos) {
        const proto = protos[index]
        // console.log('proto obj')
        // console.log(proto)
        if (proto.name === 'ip4' || proto.name === 'ip66') {
          // we have an ip, let's check it for private classes
          if (
            ip.isLoopback(maddr.nodeAddress().address) ||
            is_ip_private(maddr.nodeAddress().address) ||
            ip.isPrivate(maddr.nodeAddress().address)
          ) {
            // console.log(maddr.nodeAddress().address + ' is loopback/private. carry on')
            continue
          } else {
            // console.log('Returning only ip ' + maddr.nodeAddress().address)
            return {
              ip: maddr.nodeAddress().address,
              dns: null,
              port: maddr.nodeAddress().port,
              relay: false,
              relayNode: null
            }
          }
        }
      }
    } catch (e) {
      // we reach this part when having circuit relay. this is fine
      console.error(e)
    }
  }

  // we have no dns,no ip , maybe circuit relays
  for (const addr of addrs) {
    // console.log('Trying ' + addr)
    try {
      const maddr = multiaddr(addr)
      const protos = maddr.protos()
      if (protos.some((e) => e.name === 'p2p-circuit')) {
        for (const index in protos) {
          const proto = protos[index]
          if (proto.name === 'p2p-circuit' || proto.name === 'p2p-circuit') {
            return {
              ip: null,
              dns: null,
              port: maddr.nodeAddress().port,
              relay: true,
              relayNode: maddr.nodeAddress().address
            }
          }
        }
      }
    } catch (e) {
      console.error(e)
    }
  }
  return ipFound
}
