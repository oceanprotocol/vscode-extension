import * as vscode from 'vscode'
import { OceanProtocolViewProvider } from './viewProvider'
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
  saveResults,
  stopComputeJob,
  withRetrial
} from './helpers/compute'
import { validateDatasetFromInput } from './helpers/validation'
import { SelectedConfig } from './types'
import { ethers } from 'ethers'
import { ProviderInstance } from '@oceanprotocol/lib'

globalThis.fetch = fetch

const outputChannel = vscode.window.createOutputChannel('Ocean Protocol extension')
let config: SelectedConfig = new SelectedConfig({ isFreeCompute: true })
let provider: OceanProtocolViewProvider
let computeLogsChannel: vscode.OutputChannel

vscode.window.registerUriHandler({
  handleUri(uri: vscode.Uri) {
    const urlParams = new URLSearchParams(uri.query)
    const authToken = urlParams.get('authToken')
    const nodeUrl = urlParams.get('nodeUrl')
    const isFreeCompute = urlParams.get('isFreeCompute')
    const environmentId = urlParams.get('environmentId')
    const feeToken = urlParams.get('feeToken')
    const jobDuration = urlParams.get('jobDuration')
    const resources = urlParams.get('resources')
    const address = urlParams.get('address')
    const chainId = urlParams.get('chainId')
    console.log({ authToken, address, nodeUrl, isFreeCompute, environmentId, feeToken, jobDuration, resources })
    vscode.window.showInformationMessage('Compute job configured successfully!')
    const isFreeComputeBoolean = isFreeCompute === 'true' ? true : false
    const chainIdNumber = chainId ? Number(chainId) : undefined

    const resourcesParsed = resources ? SelectedConfig.parseResources(resources) : undefined
    config.updateFields({ authToken, address, nodeUrl, isFreeCompute: isFreeComputeBoolean, environmentId, feeToken, jobDuration, resources: resourcesParsed, chainId: chainIdNumber })
    console.log({ config })

    // Update the UI with the new values
    provider?.notifyConfigUpdate(config)
  }
});

export async function activate(context: vscode.ExtensionContext) {
  let savedSigner: ethers.Wallet | ethers.HDNodeWallet | null = null
  let savedJobId: string | null = null
  let savedNodeUrl: string | null = null

  outputChannel.show()
  outputChannel.appendLine('Ocean Protocol extension is now active!')
  console.log('Ocean Protocol extension is now active!')

  try {
    // Create and register the webview provider
    provider = new OceanProtocolViewProvider()
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

    // Listen for active editor changes
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        let filePath = null
        if (editor && editor.document.uri.scheme === 'file') {
          const fileExtension = editor.document.uri.fsPath.split('.').pop()?.toLowerCase()
          if (fileExtension === 'js' || fileExtension === 'py') {
            filePath = editor.document.uri.fsPath
          }
        }
        provider.sendMessage({
          type: 'activeEditorChanged',
          filePath: filePath
        })
      })
    )

    // Create a test command to verify the webview is accessible
    let testCommand = vscode.commands.registerCommand('ocean-protocol.test', () => {
      console.log('Test command executed')
      if (provider?.resolveWebviewView) {
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

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'ocean-protocol.stopComputeJob',
        async () => {
          if (!savedJobId) {
            vscode.window.showErrorMessage('No active job to stop')
            return
          }
          try {
            await stopComputeJob(savedNodeUrl, savedJobId, savedSigner)
            savedJobId = null
            provider.sendMessage({ type: 'jobStopped' })
            vscode.window.showInformationMessage('Job stopped successfully')
          } catch (error) {
            vscode.window.showErrorMessage('Failed to stop job')
          }
        }
      )
    )
    let startComputeJob = vscode.commands.registerCommand(
      'ocean-protocol.startComputeJob',
      async (
        algorithmPath: string,
        resultsFolderPath: string,
        authToken: string | undefined,
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
        console.log('Auth token:', authToken)
        console.log('Docker image:', dockerImage)
        console.log('Docker tag:', dockerTag)
        console.log('Environment ID:', environmentId)
        const missingParams = []
        !algorithmPath && missingParams.push('algorithm path')
        !nodeUrl && missingParams.push('node URL')

        // Save the node URL to know which node to stop the job on
        savedNodeUrl = nodeUrl

        if (missingParams.length > 0) {
          vscode.window.showErrorMessage(
            `Missing required parameters: ${missingParams.join(', ')}`
          )
          return
        }

        let signer: ethers.HDNodeWallet
        if (!authToken || authToken === '') {
          try {
            signer = ethers.Wallet.createRandom()
            console.log('Generated new wallet address:', signer.address)
            vscode.window.showInformationMessage(
              `Using generated wallet with address: ${signer.address}`
            )
            // Generate new token and register the address in the config
            authToken = await ProviderInstance.generateAuthToken(signer, nodeUrl)
            console.log('Generated auth token:', authToken)
            config.updateFields({ address: signer.address })
          } catch (error) {
            console.log(error)
            vscode.window.showErrorMessage('Error generating auth token. Please make sure you selected a valid node')
            return
          }
        } else {
          // Create a signer for existing auth token - we'll need the address from config
          signer = ethers.Wallet.createRandom() // This will be replaced with proper implementation
        }

        // Update back the config with new values from the extension
        config.updateFields({ authToken, nodeUrl, environmentId })

        // Save signer and nodeUrl for stop job functionality
        savedSigner = signer
        savedNodeUrl = nodeUrl

        provider.sendMessage({ type: 'jobLoading' })

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

            const algorithmContent = await fs.promises.readFile(algorithmPath, 'utf8')

            // Start compute job
            const fileExtension = algorithmPath.split('.').pop()?.toLowerCase()
            const computeResponse = await computeStart(
              config,
              algorithmContent,
              fileExtension,
              dataset,
              dockerImage,
              dockerTag,
            )
            console.log('Compute result received:', computeResponse)
            const jobId = computeResponse.jobId
            // Save the job ID for future use
            savedJobId = jobId

            // Notify webview that job started
            provider.sendMessage({
              type: 'jobStarted',
              jobId: jobId
            })

            outputChannel.show()
            outputChannel.appendLine(`Starting compute job with ID: ${jobId}`)

            // Start fetching logs periodically
            let logStreamStarted = false

            const computeLogsChannel = vscode.window.createOutputChannel(
              `Algorithm Logs - ${jobId.slice(0, 3)}...`
            )
            while (true) {
              console.log('Checking job status...')
              const status = await withRetrial(
                () => checkComputeStatus(config, jobId),
                progress
              )
              console.log('Job status:', status)
              console.log('Status text:', status.statusText)
              progress.report({ message: `${status.statusText}` })
              outputChannel.appendLine(`Job status: ${status.statusText}`)

              // Start log streaming when job is running
              if (status.statusText.includes('Running algorithm') && !logStreamStarted) {
                logStreamStarted = true
                // Start fetching logs once
                withRetrial(
                  () => getComputeLogs(config, jobId, computeLogsChannel),
                  progress
                )
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
                  const logResult = await withRetrial(
                    () => getComputeResult(config, jobId, 0),
                    progress
                  )

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
                    const outputResult = await withRetrial(
                      () => getComputeResult(config, jobId, 1),
                      progress
                    )
                    const filePathOutput = await saveOutput(
                      outputResult,
                      resultsFolderPath,
                      'result-output'
                    )
                    outputChannel.appendLine(`Output saved to: ${filePathOutput}`)
                    // Reset job state and notify webview that job completed
                    savedJobId = null
                    provider.sendMessage({ type: 'jobCompleted' })

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
                // Reset job state and notify webview on failure
                savedJobId = null
                provider.sendMessage({ type: 'jobStopped' })
                throw new Error(`Job failed with status: ${status.statusText}`)
              }

              await delay(5000) // Wait 5 seconds before checking again
            }
          })
        } catch (error) {
          console.error('Error details:', error)

          // Reset job state and notify webview on error
          savedJobId = null
          provider.sendMessage({ type: 'jobStopped' })

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
