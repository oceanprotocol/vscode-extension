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

  context.subscriptions.push(getAssetDetails)
}

export function deactivate() {}
