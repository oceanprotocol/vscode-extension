import * as vscode from 'vscode'
import { OceanProtocolViewProvider } from './viewProvider'
import { ethers } from 'ethers'
import * as fs from 'fs'
import fetch from 'cross-fetch'
import {
  checkComputeStatus,
  computeStart,
  delay,
  getComputeEnvironments,
  getComputeLogs,
  getComputeResult,
  saveOutput,
  saveResults
} from './helpers/compute'
import { validateDatasetFromInput } from './helpers/validation'

globalThis.fetch = fetch

let computeLogsChannel: vscode.OutputChannel

const outputChannel = vscode.window.createOutputChannel('Ocean Protocol extension')

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

    // Add handler for environment loading
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'ocean-protocol.getEnvironments',
        async (nodeUrl: string) => {
          return await getComputeEnvironments(nodeUrl)
        }
      )
    )

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'ocean-protocol.validateDataset',
        async (nodeUrl: string, input: string) => {
          return await validateDatasetFromInput(nodeUrl, input)
        }
      )
    )
    // Rest of your existing startComputeJob command registration...
    let startComputeJob = vscode.commands.registerCommand(
      'ocean-protocol.startComputeJob',
      async (
        algorithmPath: string,
        resultsFolderPath: string,
        privateKey: string | undefined,
        nodeUrl: string,
        dataset?: string,
        dockerImage?: string,
        dockerTag?: string,
        environmentId?: string
      ) => {
        console.log('1. Starting compute job...')
        console.log('Dataset:', dataset)
        console.log('Algorithm path:', algorithmPath)
        console.log('Results folder path:', resultsFolderPath)
        console.log('Node URL:', nodeUrl)
        console.log('Private key:', privateKey)
        console.log('Docker image:', dockerImage)
        console.log('Docker tag:', dockerTag)
        console.log('Environment ID:', environmentId)
        const missingParams = []
        !algorithmPath && missingParams.push('algorithm path')
        !nodeUrl && missingParams.push('node URL')

        if (missingParams.length > 0) {
          vscode.window.showErrorMessage(
            `Missing required parameters: ${missingParams.join(', ')}`
          )
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

            const algorithmContent = await fs.promises.readFile(algorithmPath, 'utf8')

            // Start compute job
            const fileExtension = algorithmPath.split('.').pop()?.toLowerCase()
            const computeResponse = await computeStart(
              algorithmContent,
              signer,
              nodeUrl,
              fileExtension,
              environmentId,
              dataset,
              dockerImage,
              dockerTag
            )
            console.log('Compute result received:', computeResponse)
            const jobId = computeResponse.jobId
            console.log('Job ID:', jobId)

            outputChannel.show()
            outputChannel.appendLine(`Starting compute job with ID: ${jobId}`)

            // Start fetching logs periodically
            let logStreamStarted = false

            while (true) {
              console.log('Checking job status...')
              const status = await checkComputeStatus(nodeUrl, signer.address, jobId)
              console.log('Job status:', status)
              console.log('Status text:', status.statusText)
              progress.report({ message: `${status.statusText}` })
              outputChannel.appendLine(`Job status: ${status.statusText}`)

              // Start log streaming when job is running
              if (status.statusText.includes('Running algorithm') && !logStreamStarted) {
                logStreamStarted = true
                // Start fetching logs once
                getComputeLogs(nodeUrl, signer, jobId, computeLogsChannel)
              }

              if (status.statusText === 'Job finished') {
                try {
                  // First request (index 0)
                  console.log('Generating signature for logs request...')
                  progress.report({ message: 'Generating signature for logs request...' })
                  outputChannel.appendLine('Generating signature for logs request...')

                  // Retrieve first result (index 0)
                  progress.report({ message: 'Retrieving compute results (1/2)...' })
                  outputChannel.appendLine('Retrieving logs...')
                  const logResult = await getComputeResult(signer, nodeUrl, jobId, 0)

                  // Save first result
                  progress.report({ message: 'Saving first result...' })
                  outputChannel.appendLine('Saving first result...')
                  console.log('Saving first result to folder path:', resultsFolderPath)
                  const filePathLogs = await saveResults(
                    logResult,
                    resultsFolderPath,
                    'result-logs'
                  )
                  outputChannel.appendLine(`Logs saved to: ${filePathLogs}`)

                  let filePath2: string | undefined

                  try {
                    // Second request (index 1) with new nonce and signature
                    progress.report({
                      message: 'Requesting the output result...'
                    })
                    outputChannel.appendLine('Requesting the output result...')
                    const outputResult = await getComputeResult(signer, nodeUrl, jobId, 1)
                    const filePathOutput = await saveOutput(
                      outputResult,
                      resultsFolderPath,
                      'result-output'
                    )
                    outputChannel.appendLine(`Output saved to: ${filePathOutput}`)
                    vscode.window.showInformationMessage(
                      'Compute job completed successfully!'
                    )
                    outputChannel.appendLine('Compute job completed successfully!')
                  } catch (error) {
                    console.log('No second result available:', error)
                    outputChannel.appendLine('Error saving the output result')
                    vscode.window.showErrorMessage('Error saving the output result')
                  }

                  // Open log files in editor
                  const uri1 = vscode.Uri.file(filePathLogs)
                  const document1 = await vscode.workspace.openTextDocument(uri1)
                  await vscode.window.showTextDocument(document1, { preview: false })

                  break
                } catch (error) {
                  console.error('Error retrieving results:', error)
                  throw error
                }
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
          if (error instanceof Error && error.message) {
            vscode.window.showErrorMessage(`Error with compute job: ${error.message}`)
          } else {
            vscode.window.showErrorMessage('Something went wrong. Please try again.')
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
