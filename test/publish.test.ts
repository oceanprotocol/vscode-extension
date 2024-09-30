import { expect } from 'chai'
import { ethers } from 'ethers'
import { Aquarius } from '@oceanprotocol/lib'
import { createAsset } from '../src/helpers/publish'
import * as dotenv from 'dotenv'

dotenv.config()

describe('createAsset function', function () {
  this.timeout(60000) // Set timeout to 60 seconds

  let provider: ethers.providers.JsonRpcProvider
  let signer: ethers.Signer
  let aquarius: Aquarius

  before(async () => {
    // Setup provider and signer
    const rpcUrl = process.env.RPC_URL || 'http://localhost:8545'
    provider = new ethers.providers.JsonRpcProvider(rpcUrl)

    const privateKey = process.env.PRIVATE_KEY
    if (!privateKey) {
      throw new Error('PRIVATE_KEY not set in environment')
    }
    signer = new ethers.Wallet(privateKey, provider)

    // Setup Aquarius
    const aquariusUrl = process.env.OCEAN_NODE_URL || 'http://127.0.0.1:8001'
    aquarius = new Aquarius(aquariusUrl)
  })

  it('should successfully create an asset', async () => {
    const name = 'Test Asset'
    const symbol = 'TST'
    const assetUrl = {
      datatokenAddress: '0x0000000000000000000000000000000000000000',
      nftAddress: '0x0000000000000000000000000000000000000000',
      files: [
        {
          type: 'url',
          url: 'https://example.com/test.txt',
          method: 'GET'
        }
      ]
    }
    const ddo = {
      '@context': ['https://w3id.org/did/v1'],
      id: '',
      version: '4.1.0',
      chainId: await signer.getChainId(),
      nftAddress: '0x0000000000000000000000000000000000000000',
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        type: 'dataset',
        name: 'Test Dataset',
        description: 'This is a test dataset',
        author: 'Test Author',
        license: 'CC0'
      },
      services: [
        {
          id: 'testServiceId',
          type: 'access',
          files: '',
          datatokenAddress: '0x0000000000000000000000000000000000000000',
          serviceEndpoint: 'http://localhost:8030',
          timeout: 0
        }
      ],
      stats: {
        price: {
          value: 10
        }
      }
    }
    const providerUrl = process.env.OCEAN_NODE_URL || 'http://localhost:8001'

    try {
      const assetId = await createAsset(
        name,
        symbol,
        signer,
        assetUrl,
        ddo,
        providerUrl,
        aquarius
      )

      expect(assetId).to.be.a('string')
      expect(assetId).to.match(/^did:op:[a-fA-F0-9]{64}$/)

      // You can add more assertions here to check the created asset details
    } catch (error) {
      console.error('Error creating asset:', error)
      throw error
    }
  })
})
