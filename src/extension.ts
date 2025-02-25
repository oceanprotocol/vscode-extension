import * as vscode from 'vscode'
import { OceanProtocolViewProvider } from './viewProvider'
import { ethers } from 'ethers'
import * as fs from 'fs'
import fetch from 'cross-fetch'
import {
  checkComputeStatus,
  computeStart,
  delay,
  getComputeLogs,
  getComputeResult,
  saveOutput,
  saveResults
} from './helpers/compute'
import { generateOceanSignature } from './helpers/signature'
import * as path from 'path'

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

    // Rest of your existing startComputeJob command registration...
    let startComputeJob = vscode.commands.registerCommand(
      'ocean-protocol.startComputeJob',
      async (
        algorithmPath: string,
        resultsFolderPath: string,
        privateKey: string | undefined,
        nodeUrl: string,
        datasetPath?: string,
        dockerImage?: string,
        dockerTag?: string
      ) => {
        console.log('1. Starting compute job...')
        console.log('Dataset path:', datasetPath)
        console.log('Algorithm path:', algorithmPath)
        console.log('Results folder path:', resultsFolderPath)
        console.log('Node URL:', nodeUrl)
        console.log('Private key:', privateKey)
        console.log('Docker image:', dockerImage)
        console.log('Docker tag:', dockerTag)
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
            const fileExtension = algorithmPath.split('.').pop()?.toLowerCase()
            const computeResponse = await computeStart(
              algorithmContent,
              signer,
              nodeUrl,
              fileExtension,
              dataset,
              nonce,
              dockerImage,
              dockerTag
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
                try {
                  // First request (index 0)
                  const nonce1 = Date.now()
                  console.log('Generating signature for first result...')
                  progress.report({ message: 'Generating signature for first result...' })
                  outputChannel.appendLine('Generating signature for first result...')
                  const signatureResult1 = await generateOceanSignature({
                    signer,
                    consumerAddress: signer.address,
                    jobId,
                    index: 0,
                    nonce: nonce1
                  })

                  // Retrieve first result (index 0)
                  progress.report({ message: 'Retrieving compute results (1/2)...' })
                  outputChannel.appendLine('Retrieving first result...')
                  const results1 = await getComputeResult(
                    nodeUrl,
                    jobId,
                    signer.address,
                    signatureResult1.signature,
                    0,
                    nonce1
                  )

                  // Save first result
                  progress.report({ message: 'Saving first result...' })
                  outputChannel.appendLine('Saving first result...')
                  console.log('Saving first result to folder path:', resultsFolderPath)
                  const filePath1 = await saveResults(
                    results1,
                    resultsFolderPath,
                    'result1'
                  )

                  let filePath2: string | undefined

                  try {
                    // Second request (index 1) with new nonce and signature
                    const nonce2 = Date.now()
                    console.log('Generating signature for second result...')
                    progress.report({
                      message: 'Generating signature for second result...'
                    })
                    outputChannel.appendLine('Generating signature for second result...')
                    const signatureResult2 = await generateOceanSignature({
                      signer,
                      consumerAddress: signer.address,
                      jobId,
                      index: 1,
                      nonce: nonce2
                    })

                    // Try to retrieve second result (index 1)
                    progress.report({ message: 'Retrieving compute results (2/2)...' })
                    outputChannel.appendLine('Retrieving second result...')
                    const results2 = await getComputeResult(
                      nodeUrl,
                      jobId,
                      signer.address,
                      signatureResult2.signature,
                      1,
                      nonce2
                    )

                    // Save second result if it exists
                    progress.report({ message: 'Saving second result...' })
                    outputChannel.appendLine('Saving second result...')
                    console.log('Saving second result to folder path:', resultsFolderPath)
                    filePath2 = await saveOutput(results2, resultsFolderPath, 'output')

                    // After getting the second result
                    console.log('Second result content type:', typeof results2)
                    console.log('Second result keys:', Object.keys(results2))
                    console.log('File extension:', path.extname(filePath2))

                    // Check file contents
                    const fileStats = await fs.promises.stat(filePath2)
                    console.log('File size:', fileStats.size)
                  } catch (error) {
                    console.log('No second result available:', error)
                    outputChannel.appendLine('No second result available')
                  }

                  // Show success message with available results
                  const successMessage = filePath2
                    ? `Compute job completed successfully! Results saved to:\n${filePath1}\n${filePath2}`
                    : `Compute job completed successfully! Result saved to:\n${filePath1}`

                  vscode.window.showInformationMessage(successMessage)
                  outputChannel.appendLine(successMessage)

                  // Open files in editor
                  const uri1 = vscode.Uri.file(filePath1)
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
