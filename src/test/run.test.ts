const mockRequire = require('mock-require')

const p2pMock = {
  P2PCommand: async () => {}
}

const p2pPath = require.resolve('../helpers/p2p')
mockRequire(p2pPath, p2pMock)

require('./extension.test')
