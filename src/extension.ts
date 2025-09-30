import * as vscode from 'vscode'
import { OceanProtocolViewProvider } from './viewProvider'
import * as fs from 'fs'
import * as path from 'path'
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
import { ethers, Signer } from 'ethers'
import { ProviderInstance } from '@oceanprotocol/lib'
import { checkAndReadFile, listDirectoryContents } from './helpers/path'

globalThis.fetch = fetch

const outputChannel = vscode.window.createOutputChannel('Ocean Protocol extension')
let config: SelectedConfig = new SelectedConfig({ isFreeCompute: true })
let provider: OceanProtocolViewProvider

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
  let savedSigner: Signer | null = null
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
        async (authToken: string) => {
          if (!savedJobId) {
            vscode.window.showErrorMessage('No active job to stop')
            return
          }
          try {
            await stopComputeJob(savedNodeUrl, savedJobId, authToken || savedSigner)
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

        // Save the node URL for future use
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
            savedSigner = signer
            console.log('Generated new wallet address:', signer.address)
            vscode.window.showInformationMessage(
              `Using generated wallet with address: ${signer.address}`
            )
            // Generate new token and register the address in the config
            authToken = await ProviderInstance.generateAuthToken(signer, nodeUrl)
            config.updateFields({ address: signer.address })
          } catch (error) {
            console.log(error)
            vscode.window.showErrorMessage('Error generating auth token. Please make sure you selected a valid node')
            return
          }
        }

        // Update back the config with new values from the extension
        config.updateFields({ authToken, nodeUrl, environmentId })
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
            const algorithmDir = path.dirname(algorithmPath)

            // Get dockerfile
            const dockerfile = await checkAndReadFile(algorithmDir, 'Dockerfile')

            // Get additional docker files
            const directoryContents = await listDirectoryContents(algorithmDir)
            let additionalDockerFiles: { [key: string]: string } = {}

            // Map additional docker files
            directoryContents.forEach(async (file) => {
              if (file !== 'Dockerfile') {
                additionalDockerFiles[file] = await checkAndReadFile(algorithmDir, file)
              }
            })

            const computeResponse = await computeStart(
              config,
              algorithmContent,
              fileExtension,
              dataset,
              dockerImage,
              dockerTag,
              dockerfile,
              additionalDockerFiles
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

              if (
                status.statusText.toLowerCase().includes('error') ||
                status.statusText.toLowerCase().includes('failed')
              ) {
                // Reset job state and notify webview on failure
                savedJobId = null
                provider.sendMessage({ type: 'jobStopped' })
                throw new Error(`Job failed with status: ${status.statusText}`)
              }

              if (status.dateFinished) {
                try {
                  console.log('Generating signature for request...')
                  progress.report({ message: 'Generating signature for request...' })
                  outputChannel.appendLine('Generating signature for request...')
                  const resultsLength = status.results.length
                  const archive = status.results.find(result => result.filename.includes('.tar'))
                  const resultsWithoutArchive = status.results.filter(result => result.index !== archive?.index)

                  for (const result of resultsWithoutArchive) {
                    progress.report({ message: `Retrieving compute results (${result.index + 1}/${resultsLength})...` })
                    outputChannel.appendLine(`Retrieving compute results (${result.index + 1}/${resultsLength})...`)
                    const filePathLogs = await getAndSaveLogs(config, jobId, result.index, result.filename, resultsFolderPath, progress)

                    // Open log files in editor
                    const uri = vscode.Uri.file(filePathLogs)
                    const document = await vscode.workspace.openTextDocument(uri)
                    await vscode.window.showTextDocument(document, { preview: false })
                  }

                  try {
                    progress.report({
                      message: 'Requesting the output result...'
                    })
                    outputChannel.appendLine('Requesting the output result...')
                    const outputResult = await withRetrial(
                      () => getComputeResult(config, jobId, archive?.index),
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

                  break
                } catch (error) {
                  console.error('Error retrieving results:', error)
                  throw error
                }
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
            vscode.window.showErrorMessage(error.message)
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

async function getAndSaveLogs(config: SelectedConfig, jobId: string, index: number, fileName: string, resultsFolderPath: string, progress: vscode.Progress<{ message?: string }>) {
  const imageResult = await withRetrial(
    () => getComputeResult(config, jobId, index),
    progress
  )

  progress.report({ message: `Saving ${fileName}...` })
  outputChannel.appendLine(`Saving ${fileName}...`)
  const filePathLogs = await saveResults(
    imageResult,
    resultsFolderPath,
    fileName
  )
  outputChannel.appendLine(`${fileName} saved to: ${filePathLogs}`)
  return filePathLogs
}
