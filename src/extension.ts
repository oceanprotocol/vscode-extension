import * as vscode from 'vscode'
import { Aquarius, Asset, ConfigHelper } from '@oceanprotocol/lib'
import { OceanProtocolViewProvider } from './viewProvider'
import { ethers } from 'ethers'
import * as fs from 'fs'
import { createAsset } from './helpers/publish'
import fetch from 'cross-fetch'
import { spawn } from 'child_process'
import * as path from 'path'

globalThis.fetch = fetch

let oceanNode: any

async function startOceanNode(context: vscode.ExtensionContext): Promise<void> {
  const oceanNodePath = path.join(
    context.extensionPath,
    'node_modules',
    '.bin',
    'ocean-node'
  )

  const env = {
    ...process.env,
    PRIVATE_KEY: '0x0000000000000000000000000000000000000000000000000000000000000001', // Replace with a valid private key
    HTTP_API_PORT: '8000',
    INTERFACES: '["HTTP"]',
    RPCS: JSON.stringify({
      '11155111': {
        rpc: 'https://eth-sepolia.public.blastapi.io',
        chainId: 11155111,
        network: 'sepolia',
        chunkSize: 100
      }
    }),
    DB_URL: 'http://localhost:8108/?apiKey=xyz',
    IPFS_GATEWAY: 'https://ipfs.io/',
    ARWEAVE_GATEWAY: 'https://arweave.net/',
    LOG_LEVEL: 'debug'
  }

  oceanNode = spawn(oceanNodePath, [], { env })

  oceanNode.stdout.on('data', (data) => {
    console.log(`Ocean Node stdout: ${data}`)
  })

  oceanNode.stderr.on('data', (data) => {
    console.error(`Ocean Node stderr: ${data}`)
  })

  oceanNode.on('close', (code) => {
    console.log(`Ocean Node process exited with code ${code}`)
  })

  vscode.window.showInformationMessage('Ocean Node started')
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Ocean Protocol extension is now active!')

  // Start Ocean Node
  startOceanNode(context)
    .then(() => console.log('Ocean Node started successfully'))
    .catch((error) => console.error('Failed to start Ocean Node:', error))

  const provider = new OceanProtocolViewProvider(context.extensionUri)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      OceanProtocolViewProvider.viewType,
      provider
    )
  )

  let getAssetDetails = vscode.commands.registerCommand(
    'ocean-protocol.getAssetDetails',
    async (config: any, did: string) => {
      if (!did) {
        vscode.window.showErrorMessage('No DID provided.')
        return
      }

      if (!config.aquariusUrl) {
        vscode.window.showErrorMessage('No Aquarius URL provided.')
        return
      }

      try {
        const aquariusUrl = new URL(config.aquariusUrl).toString()
        const aquarius = new Aquarius(aquariusUrl)
        const asset = await aquarius.resolve(did)

        if (asset) {
          const details = `
            Name: ${asset.metadata.name}
            Type: ${asset.metadata.type}
            Description: ${asset.metadata.description}
            Author: ${asset.metadata.author}
          `
          vscode.window.showInformationMessage(details)
        } else {
          vscode.window.showInformationMessage('Asset not found.')
        }
      } catch (error) {
        console.error('Error details:', error)
        if (error instanceof Error) {
          vscode.window.showErrorMessage(`Error getting asset details: ${error.message}`)
        } else {
          vscode.window.showErrorMessage(
            `An unknown error occurred while getting asset details.`
          )
        }
      }
    }
  )

  let publishAsset = vscode.commands.registerCommand(
    'ocean-protocol.publishAsset',
    async (config: any, filePath: string, privateKey: string) => {
      vscode.window.showInformationMessage(`Private key: ${privateKey}`)
      vscode.window.showInformationMessage(`File path: ${filePath}`)
      vscode.window.showInformationMessage(`Config: ${JSON.stringify(config)}`)
      if (!filePath) {
        vscode.window.showErrorMessage('No file path provided.')
        return
      }

      if (!privateKey) {
        vscode.window.showErrorMessage('No private key provided.')
        return
      }

      try {
        // Read the file
        const fileContent = fs.readFileSync(filePath, 'utf8')
        vscode.window.showInformationMessage('File content read successfully.')

        const asset: Asset = JSON.parse(fileContent)
        vscode.window.showInformationMessage('Asset JSON parsed successfully.')

        // Set up the signer
        const provider = new ethers.providers.JsonRpcProvider(process.env.RPC)

        console.log('RPC URL:', config.rpcUrl)

        console.log('NFT Factory Address:', config.nftFactoryAddress)
        console.log('Ocean Token Address:', config.oceanTokenAddress)

        const signer = new ethers.Wallet(privateKey, provider)
        console.log('Signer:', signer)
        const chainId = await signer.getChainId()
        console.log('Chain ID:', chainId)
        vscode.window.showInformationMessage(`Signer: ${signer}`)

        // Test provider connectivity
        try {
          const network = provider.network
          vscode.window.showInformationMessage(`Connected to network: ${network}`)
        } catch (networkError) {
          console.error('Error connecting to network:', networkError)
          vscode.window.showErrorMessage(
            `Error connecting to network: ${networkError.message}`
          )
          return
        }
        try {
          const blockNumber = await provider.getBlockNumber()
          console.log('Current block number:', blockNumber)
        } catch (error) {
          console.error('Error connecting to provider:', error)
        }

        const aquarius = new Aquarius(config.aquariusUrl)
        console.log('Chain ID:', chainId)
        vscode.window.showInformationMessage(`Chain ID: ${chainId}`)
        const oceanConfig = new ConfigHelper().getConfig(chainId)
        vscode.window.showInformationMessage(
          `Ocean Config: ${JSON.stringify(oceanConfig)}`
        )
        console.log('Ocean Config:', oceanConfig)
        console.log('creating asset:', asset)

        const urlAssetId = await createAsset(
          asset.nft.name,
          asset.nft.symbol,
          signer,
          asset.services[0].files,
          asset,
          config.providerUrl,
          aquarius,
          undefined, // macOsProviderUrl
          true // encryptDDO
        )

        vscode.window.showInformationMessage(
          `Asset published successfully. ID: ${urlAssetId}`
        )
      } catch (error) {
        console.error('Error details:', error)
        if (error instanceof Error) {
          vscode.window.showErrorMessage(`Error publishing asset: ${error.message}`)
        } else {
          vscode.window.showErrorMessage(
            `An unknown error occurred while publishing the asset.`
          )
        }
      }
    }
  )

  context.subscriptions.push(getAssetDetails, publishAsset)
}

export function deactivate() {
  if (oceanNode) {
    oceanNode.kill()
    console.log('Ocean Node process terminated')
  }
  console.log('Ocean Protocol extension is now deactivated!')
}
