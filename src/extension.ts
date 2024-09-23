import * as vscode from 'vscode'
import { Aquarius, Asset } from '@oceanprotocol/lib'
import { OceanProtocolViewProvider } from './viewProvider'

export function activate(context: vscode.ExtensionContext) {
  console.log('Ocean Protocol extension is now active!')

  const provider = new OceanProtocolViewProvider(context.extensionUri)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      OceanProtocolViewProvider.viewType,
      provider
    )
  )

  // Command to search for assets
  let searchAssets = vscode.commands.registerCommand(
    'ocean-protocol.searchAssets',
    async (config: any) => {
      const searchTerm = await vscode.window.showInputBox({
        prompt: 'Enter search term for Ocean assets'
      })
      if (searchTerm) {
        try {
          const aquarius = new Aquarius(config.aquariusUrl)
          const query = { query: { query_string: { query: searchTerm } } }
          const result = await aquarius.querySearch(query)

          if (result && result.hits && result.hits.hits) {
            const assets = result.hits.hits.map((hit: any) => hit._source as Asset)
            const assetNames = assets.map((asset) => asset.metadata.name)
            vscode.window.showInformationMessage(`Found assets: ${assetNames.join(', ')}`)
          } else {
            vscode.window.showInformationMessage('No assets found.')
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Error searching assets: ${error}`)
        }
      }
    }
  )

  // Command to get asset details
  let getAssetDetails = vscode.commands.registerCommand(
    'ocean-protocol.getAssetDetails',
    async (config: any) => {
      const did = await vscode.window.showInputBox({
        prompt: 'Enter DID of the Ocean asset'
      })
      if (did) {
        try {
          const aquarius = new Aquarius(config.aquariusUrl)
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
          vscode.window.showErrorMessage(`Error getting asset details: ${error}`)
        }
      }
    }
  )

  context.subscriptions.push(searchAssets, getAssetDetails)
}

export function deactivate() {}
