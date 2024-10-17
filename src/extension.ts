import * as vscode from 'vscode'
import { Aquarius, Asset, ConfigHelper } from '@oceanprotocol/lib'
import { OceanProtocolViewProvider } from './viewProvider'
import { ethers } from 'ethers'
import * as fs from 'fs'
import { createAsset } from './helpers/publish'
import fetch from 'cross-fetch'
import { download } from './helpers/download'

globalThis.fetch = fetch

export function activate(context: vscode.ExtensionContext) {
  console.log('Ocean Protocol extension is now active!')

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

        const asset: Asset = JSON.parse(fileContent)
        console.log('Asset JSON parsed successfully.')

        // Set up the signer
        const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl)

        const signer = new ethers.Wallet(privateKey, provider)

        // Test provider connectivity
        try {
          provider.network
        } catch (networkError) {
          console.error('Error connecting to network:', networkError)
          vscode.window.showErrorMessage(
            `Error connecting to network: ${networkError.message}`
          )
          return
        }

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

  let downloadAsset = vscode.commands.registerCommand(
    'ocean-protocol.downloadAsset',
    async (config: any, filePath: string, privateKey: string, assetDid: string) => {
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
        const chainId = await signer.getChainId()
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

        const aquarius = new Aquarius(config.aquariusUrl)
        vscode.window.showInformationMessage(`Chain ID: ${chainId}`)
        const oceanConfig = new ConfigHelper().getConfig(chainId)
        vscode.window.showInformationMessage(
          `Ocean Config: ${JSON.stringify(oceanConfig)}`
        )

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
      } catch (error) {
        console.error('Error details:', error)
        if (error instanceof Error) {
          vscode.window.showErrorMessage(`Error downloading asset: ${error.message}`)
        } else {
          vscode.window.showErrorMessage(
            `An unknown error occurred while downloading the asset.`
          )
        }
      }
    }
  )

  context.subscriptions.push(getAssetDetails, publishAsset, downloadAsset)
}

export function deactivate() {}
