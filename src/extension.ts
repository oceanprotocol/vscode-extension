import * as vscode from 'vscode'
import { Aquarius, Asset } from '@oceanprotocol/lib'
import { OceanProtocolViewProvider } from './viewProvider'
import { ethers } from 'ethers'
import * as fs from 'fs'
import { createAsset } from './helpers/publish'
import fetch from 'cross-fetch'
import { OceanP2P } from './helpers/oceanNode'
import { download } from './helpers/download'
import {
  checkComputeStatus,
  computeStart,
  delay,
  getComputeResult,
  saveResults
} from './helpers/freeCompute'
import { generateOceanSignature } from './helpers/signature'

globalThis.fetch = fetch
const node = new OceanP2P()

const outputChannel = vscode.window.createOutputChannel('Ocean Protocol')

async function startOceanNode(): Promise<string> {
  await node.start()
  // sleep for 3 seconds
  await new Promise((resolve) => setTimeout(resolve, 3000))

  const thisNodeId = node._config.keys.peerId.toString()
  console.log('Node ' + thisNodeId + ' started.')
  vscode.window.showInformationMessage(`Ocean Node started with ID: ${thisNodeId}`)
  outputChannel.appendLine(`Ocean Node started with ID: ${thisNodeId}`)
  return thisNodeId
}

export async function activate(context: vscode.ExtensionContext) {
  outputChannel.show()
  outputChannel.appendLine('Ocean Protocol extension is now active!')
  console.log('Ocean Protocol extension is now active!')

  const nodeId = await startOceanNode()

  const provider = new OceanProtocolViewProvider(context.extensionUri, nodeId)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      OceanProtocolViewProvider.viewType,
      provider
    )
  )

  let getAssetDetails = vscode.commands.registerCommand(
    'ocean-protocol.getAssetDetails',
    async (config: any, did: string) => {
      outputChannel.appendLine('\n\nGetting asset details...')
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

        outputChannel.appendLine(`Asset details: ${JSON.stringify(asset)}`)

        if (asset) {
          const details = `
            Name: ${asset.metadata.name}\n
            Type: ${asset.metadata.type}\n
            Description: ${asset.metadata.description}\n
            Author: ${asset.metadata.author}\n
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
      outputChannel.appendLine('\n\nPublishing file...')

      if (!config) {
        vscode.window.showErrorMessage('No config provided.')
        return
      }
      if (!filePath) {
        vscode.window.showErrorMessage('No file path provided.')
        return
      }

      if (!privateKey) {
        vscode.window.showErrorMessage('No private key provided.')
        return
      }
      vscode.window.showInformationMessage('Publishing asset')

      try {
        // Read the file
        const fileContent = fs.readFileSync(filePath, 'utf8')
        console.log('File content read successfully.')
        outputChannel.appendLine('File content read successfully.')

        const asset: Asset = JSON.parse(fileContent)
        console.log('Asset JSON parsed successfully.')

        // Set up the signer
        console.log(config.rpcUrl)
        const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl)

        const signer = new ethers.Wallet(privateKey, provider)

        const aquarius = new Aquarius(config.aquariusUrl)

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

        outputChannel.appendLine(`\n\nAsset published successfully. ID: ${urlAssetId}`)
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

  let getOceanPeers = vscode.commands.registerCommand(
    'ocean-protocol.getOceanPeers',
    async () => {
      try {
        outputChannel.appendLine('\n\nGetting Ocean Node Peers...')
        const peers = await node.getOceanPeers()
        if (peers && peers.length > 0) {
          vscode.window.showInformationMessage(`Ocean Peers:\n${peers.join('\n')}`)
        } else {
          vscode.window.showInformationMessage('No Ocean Peers found.')
        }
      } catch (error) {
        console.error('Error getting Ocean Peers:', error)
        if (error instanceof Error) {
          vscode.window.showErrorMessage(`Error getting Ocean Peers: ${error.message}`)
        } else {
          vscode.window.showErrorMessage(
            'An unknown error occurred while getting Ocean Peers.'
          )
        }
      }
    }
  )

  let downloadAsset = vscode.commands.registerCommand(
    'ocean-protocol.downloadAsset',
    async (config: any, filePath: string, privateKey: string, assetDid: string) => {
      outputChannel.appendLine('\n\nDownloading asset...')
      if (!config) {
        vscode.window.showErrorMessage('No config provided.')
        return
      }
      if (!assetDid) {
        vscode.window.showErrorMessage('No DID provided.')
        return
      }
      if (!filePath) {
        vscode.window.showErrorMessage('No file path provided.')
        return
      }

      if (!privateKey) {
        vscode.window.showErrorMessage('No private key provided.')
        return
      }

      try {
        // Set up the signer
        const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl)
        const signer = new ethers.Wallet(privateKey, provider)
        console.log(`Signer: ${signer}`)

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

        const aquarius = new Aquarius(config.aquariusUrl)

        await download(
          assetDid,
          signer,
          filePath,
          aquarius,
          undefined,
          config.providerUrl
        )

        vscode.window.showInformationMessage(
          `Asset download successfully. Path: ${filePath}`
        )

        outputChannel.appendLine(`Asset download successfully. Path: ${filePath}`)
      } catch (error) {
        console.error('Error details:', error)
        outputChannel.appendLine(`Error details: ${filePath}`)
        if (error instanceof Error) {
          vscode.window.showErrorMessage(`Error downloading asset: ${error.message}`)
          outputChannel.appendLine(`Error downloading asset: ${error.message}`)
        } else {
          vscode.window.showErrorMessage(
            `An unknown error occurred while downloading the asset.`
          )
          outputChannel.appendLine(
            `An unknown error occurred while downloading the asset.`
          )
        }
      }
    }
  )

  let startComputeJob = vscode.commands.registerCommand(
    'ocean-protocol.startComputeJob',
    async (
      config: any,
      datasetPath: string,
      algorithmPath: string,
      privateKey: string,
      nodeUrl: string
    ) => {
      console.log('Starting compute job...')
      if (!config || !privateKey || !datasetPath || !algorithmPath || !nodeUrl) {
        vscode.window.showErrorMessage('Missing required parameters.')
        return
      }

      const progressOptions = {
        location: vscode.ProgressLocation.Notification,
        title: 'Compute Job Status',
        cancellable: false
      }
      console.log('Progress options:', progressOptions)

      try {
        await vscode.window.withProgress(progressOptions, async (progress) => {
          // Initial setup
          progress.report({ message: 'Starting compute job...' })
          const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl)
          console.log('Provider started')
          const signer = new ethers.Wallet(privateKey, provider)
          console.log('Signer created')

          // Read files
          const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'))
          console.log('Dataset read successfully')
          const algorithm = JSON.parse(fs.readFileSync(algorithmPath, 'utf8'))
          console.log('Algorithm read successfully')

          // nonce equals date in milliseconds
          const nonce = Date.now()
          console.log('Nonce: ', nonce)

          // Start compute job
          const computeResponse = await computeStart(
            dataset,
            algorithm,
            signer,
            nodeUrl,
            nonce
          )
          console.log('Compute result received:', computeResponse)
          const jobId = computeResponse.jobId // Assuming computeStart returns jobId
          console.log('Job ID:', jobId)

          // Monitor job status
          progress.report({ message: 'Monitoring compute job status...' })

          while (true) {
            console.log('Checking job status...')
            const status = await checkComputeStatus(nodeUrl, jobId)
            console.log('Job status:', status)
            console.log('Status text:', status.statusText)
            progress.report({ message: `${status.statusText}` })

            if (status.statusText === 'Job finished') {
              // Generate signature for result retrieval
              console.log('Generating signature for result retrieval...')
              progress.report({ message: 'Generating signature for result retrieval...' })

              const index = 0

              const signatureResult = await generateOceanSignature({
                privateKey,
                consumerAddress: signer.address,
                jobId,
                index,
                nonce
              })

              // Retrieve results
              progress.report({ message: 'Retrieving compute results...' })
              const results = await getComputeResult(
                nodeUrl,
                jobId,
                signer.address,
                signatureResult.signature,
                index,
                nonce
              )

              // Save results
              progress.report({ message: 'Saving results...' })
              const filePath = await saveResults(results)

              vscode.window.showInformationMessage(
                `Compute job completed successfully! Results saved to: ${filePath}`
              )
              break
            }

            if (
              status.statusText.toLowerCase().includes('error') ||
              status.statusText.toLowerCase().includes('failed')
            ) {
              throw new Error(`Job failed with status: ${status.statusText}`)
            }

            await delay(5000) // Wait 5 seconds before checking again
          }
        })
      } catch (error) {
        console.error('Error details:', error)
        if (error instanceof Error) {
          vscode.window.showErrorMessage(`Error with compute job: ${error.message}`)
        } else {
          vscode.window.showErrorMessage(
            'An unknown error occurred with the compute job.'
          )
        }
      }
    }
  )

  context.subscriptions.push(
    getAssetDetails,
    publishAsset,
    downloadAsset,
    getOceanPeers,
    startComputeJob
  )
}
