const mockRequire = require('mock-require')

const p2pMock = {
  P2PCommand: async () => {}
}

const p2pPath = require.resolve('../helpers/p2p')
mockRequire(p2pPath, p2pMock)

// Mock ESM-only packages that cannot be required in CJS test context
mockRequire('@multiformats/multiaddr', {
  multiaddr: (addr: string) => addr,
  isMultiaddr: () => true
})

mockRequire('uint8arrays/from-string', {
  fromString: (s: string) => Buffer.from(s)
})

mockRequire('@libp2p/utils', {
  lpStream: () => ({
    write: async () => {},
    read: async () => new Uint8Array()
  })
})

require('./extension.test')
