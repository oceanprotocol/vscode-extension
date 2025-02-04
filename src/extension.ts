import * as vscode from 'vscode'
import { OceanProtocolViewProvider } from './viewProvider'
import { ethers } from 'ethers'
import * as fs from 'fs'
import fetch from 'cross-fetch'
import { OceanP2P } from './helpers/oceanNode'
import {
  checkComputeStatus,
  computeStart,
  delay,
  getComputeLogs,
  getComputeResult,
  saveResults
} from './helpers/compute'
import { generateOceanSignature } from './helpers/signature'

globalThis.fetch = fetch
const node = new OceanP2P()

let computeLogsChannel: vscode.OutputChannel

const outputChannel = vscode.window.createOutputChannel('Ocean Protocol extension')

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

  // Create the output channel once when the extension activates
  computeLogsChannel = vscode.window.createOutputChannel('Algorithm Logs')

  try {
    // Create and register the webview provider
    const provider = new OceanProtocolViewProvider(context.extensionUri)
    console.log('Created OceanProtocolViewProvider')

    const registration = vscode.window.registerWebviewViewProvider(
      OceanProtocolViewProvider.viewType,
      provider,
      {
        // This ensures the webview is retained even when not visible
        webviewOptions: { retainContextWhenHidden: true }
      }
    )
    console.log('Registered webview provider')

    // Add to subscriptions
    context.subscriptions.push(registration)
    console.log('Added registration to subscriptions')

    // Create a test command to verify the webview is accessible
    let testCommand = vscode.commands.registerCommand('ocean-protocol.test', () => {
      console.log('Test command executed')
      if (provider.resolveWebviewView) {
        console.log('Webview is available')
      } else {
        console.log('Webview is not available')
      }
    })
    context.subscriptions.push(testCommand)

    // Rest of your existing startComputeJob command registration...
    let startComputeJob = vscode.commands.registerCommand(
      'ocean-protocol.startComputeJob',
      async (
        config: any,
        algorithmPath: string,
        resultsFolderPath: string,
        privateKey: string | undefined,
        nodeUrl: string,
        datasetPath?: string
      ) => {
        console.log('Starting compute job...')
        console.log('Config:', config)
        console.log('Dataset path:', datasetPath)
        console.log('Algorithm path:', algorithmPath)
        console.log('Results folder path:', resultsFolderPath)
        console.log('Node URL:', nodeUrl)
        if (!config || !algorithmPath || !nodeUrl) {
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

            // Generate a random wallet if no private key provided
            const signer = privateKey
              ? new ethers.Wallet(privateKey)
              : ethers.Wallet.createRandom()

            if (!privateKey) {
              console.log('Generated new wallet address:', signer.address)
              vscode.window.showInformationMessage(
                `Using generated wallet with address: ${signer.address}`
              )
            }
            console.log('Signer created')

            // Read files
            let dataset
            if (datasetPath) {
              const datasetContent = await fs.promises.readFile(datasetPath, 'utf8')
              dataset = JSON.parse(datasetContent)
            }
            const algorithmContent = await fs.promises.readFile(algorithmPath, 'utf8')

            // nonce equals date in milliseconds
            const nonce = Date.now()
            console.log('Nonce: ', nonce)

            // Start compute job
            const computeResponse = await computeStart(
              algorithmContent,
              signer,
              nodeUrl,
              dataset,
              nonce
            )
            console.log('Compute result received:', computeResponse)
            const jobId = computeResponse.jobId
            console.log('Job ID:', jobId)

            outputChannel.show()
            outputChannel.appendLine(`Starting compute job with ID: ${jobId}`)

            // Start fetching logs periodically

            const index = 0

            console.log('Generating signature for retrieval...')
            progress.report({ message: 'Generating signature for retrieval...' })
            outputChannel.appendLine('Generating signature for retrieval...')
            const signatureResult = await generateOceanSignature({
              signer,
              consumerAddress: signer.address,
              jobId,
              index,
              nonce
            })

            let logStreamStarted = false

            while (true) {
              console.log('Checking job status...')
              const status = await checkComputeStatus(nodeUrl, jobId)
              console.log('Job status:', status)
              console.log('Status text:', status.statusText)
              progress.report({ message: `${status.statusText}` })
              outputChannel.appendLine(`Job status: ${status.statusText}`)

              // Start log streaming when job is running
              if (status.statusText.includes('Running algorithm') && !logStreamStarted) {
                logStreamStarted = true
                // Start fetching logs once
                getComputeLogs(
                  nodeUrl,
                  jobId,
                  signer.address,
                  nonce,
                  signatureResult.signature,
                  computeLogsChannel
                )
              }

              if (status.statusText === 'Job finished') {
                // Retrieve results
                progress.report({ message: 'Retrieving compute results...' })
                outputChannel.appendLine('Retrieving compute results...')
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
                outputChannel.appendLine('Saving results...')
                const filePath = await saveResults(results, resultsFolderPath)

                vscode.window.showInformationMessage(
                  `Compute job completed successfully! Results saved to: ${filePath}`
                )
                outputChannel.appendLine(
                  `Compute job completed successfully! Results saved to: ${filePath}`
                )

                // Open the saved file in a new editor window
                const uri = vscode.Uri.file(filePath)
                const document = await vscode.workspace.openTextDocument(uri)
                await vscode.window.showTextDocument(document, { preview: false })

                vscode.window.showInformationMessage(
                  `Compute job completed successfully! Results opened in editor.`
                )
                outputChannel.appendLine(
                  `Compute job completed successfully! Results opened in editor.`
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
    context.subscriptions.push(startComputeJob)
  } catch (error) {
    console.error('Error during extension activation:', error)
    outputChannel.appendLine(`Error during extension activation: ${error}`)
  }
}

// Add deactivation handling
export function deactivate() {
  console.log('Ocean Protocol extension is being deactivated')
  outputChannel.appendLine('Ocean Protocol extension is being deactivated')
}
