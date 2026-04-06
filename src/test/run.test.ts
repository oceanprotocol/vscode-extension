// Mock ESM-only packages that cannot be required in CJS test context
const mockRequire = require('mock-require')

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
  }),
  UnexpectedEOFError: class UnexpectedEOFError extends Error {}
})

require('./extension.test')
