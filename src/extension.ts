import * as vscode from 'vscode'
import { OceanProtocolViewProvider } from './viewProvider'
import * as fs from 'fs'
import * as path from 'path'
import fetch from 'cross-fetch'
import {
  checkComputeStatus,
  computeStart,
  delay,
  generateAuthToken,
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
import { checkAndReadFile, listDirectoryContents } from './helpers/path'

globalThis.fetch = fetch

const outputChannel = vscode.window.createOutputChannel('Ocean Protocol extension')
let config: SelectedConfig = new SelectedConfig({ isFreeCompute: true })
let provider: OceanProtocolViewProvider

vscode.window.registerUriHandler({
  handleUri(uri: vscode.Uri) {
    const urlParams = new URLSearchParams(uri.query)
    const authToken = urlParams.get('authToken')
    const peerId = urlParams.get('peerId')
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

    const resourcesParsed = resources
      ? SelectedConfig.parseResources(resources)
      : undefined
    config.updateFields({
      authToken,
      address,
      peerId,
      isFreeCompute: isFreeComputeBoolean,
      environmentId,
      feeToken,
      jobDuration,
      resources: resourcesParsed,
      chainId: chainIdNumber
    })
    console.log({ config })

    // Update the UI with the new values
    provider?.notifyConfigUpdate(config)
  }
})

export async function activate(context: vscode.ExtensionContext) {
  let savedSigner: Signer | null = null
  let savedJobId: string | null = null
  let savedPeerId: string | null = null

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
        async (peerId: string) => {
          return await getComputeEnvironments(peerId)
        }
      )
    )

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'ocean-protocol.validateDataset',
        async (peerId: string, input: string) => {
          return await validateDatasetFromInput(peerId, input)
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
            await stopComputeJob(savedPeerId, savedJobId, authToken || savedSigner)
            vscode.window.showInformationMessage('Job stopped successfully')
          } catch (error) {
            vscode.window.showErrorMessage('Failed to stop job')
          } finally {
            savedJobId = null
            provider.sendMessage({ type: 'jobStopped' })
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
        peerId: string,
        dataset?: string,
        dockerImage?: string,
        dockerTag?: string,
        environmentId?: string
      ) => {
        console.log('1. Starting compute job...')
        console.log('Dataset:', dataset)
        console.log('Algorithm path:', algorithmPath)
        console.log('Results folder path:', resultsFolderPath)
        console.log('Peer ID:', peerId)
        console.log('Auth token:', authToken)
        console.log('Docker image:', dockerImage)
        console.log('Docker tag:', dockerTag)
        console.log('Environment ID:', environmentId)
        const missingParams = []
        !algorithmPath && missingParams.push('algorithm path')
        !peerId && missingParams.push('peer ID')

        // Save the peer ID for future use
        savedPeerId = peerId

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
            authToken = await generateAuthToken(peerId, signer)
            config.updateFields({ address: signer.address })
          } catch (error) {
            console.log(error)
            vscode.window.showErrorMessage(
              'Error generating auth token. Please make sure you selected a valid node'
            )
            return
          }
        }

        // Update back the config with new values from the extension
        config.updateFields({ authToken, peerId, environmentId })
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

            const envContent = await checkAndReadFile(algorithmDir, '.env')
            const envVars: Record<string, string> = {}
            if (envContent) {
              envContent.split('\n').forEach((line) => {
                const trimmed = line.trim()
                if (trimmed && !trimmed.startsWith('#')) {
                  const idx = trimmed.indexOf('=')
                  if (idx > 0) {
                    envVars[trimmed.substring(0, idx).trim()] = trimmed
                      .substring(idx + 1)
                      .trim()
                  }
                }
              })
            }

            const computeResponse = await computeStart(
              config,
              algorithmContent,
              fileExtension,
              dataset,
              dockerImage,
              dockerTag,
              dockerfile,
              additionalDockerFiles,
              envVars
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
                getComputeLogs(config, jobId, computeLogsChannel)
                  .catch((err) => console.log('Log stream disconnected', err))
                  .finally(() => {
                    // Reset the flag so we can reconnect if the job is still running
                    logStreamStarted = false
                  })
              }

              if (status?.terminationDetails?.OOMKilled === true) {
                const errorMessage = `Job failed: Out of memory. Exit code: ${status?.terminationDetails?.exitCode}`
                vscode.window.showErrorMessage(errorMessage)
                computeLogsChannel.appendLine(errorMessage)
                savedJobId = null
                provider.sendMessage({ type: 'jobStopped' })

                return
              }

              if (
                status.statusText.toLowerCase().includes('error') ||
                status.statusText.toLowerCase().includes('failed')
              ) {
                try {
                  await handleFailureLogsRetrieval(
                    config,
                    jobId,
                    status,
                    resultsFolderPath,
                    computeLogsChannel,
                    progress
                  )
                } catch (retrievalError) {
                  console.error('Error retrieving logs on failure:', retrievalError)
                }

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
                  const archive = status.results.find((result) =>
                    result.filename.includes('.tar')
                  )
                  const resultsWithoutArchive = status.results.filter(
                    (result) => result.index !== archive?.index
                  )

                  computeLogsChannel.clear()
                  for (const result of resultsWithoutArchive) {
                    progress.report({
                      message: `Retrieving compute results (${result.index + 1}/${resultsLength})...`
                    })
                    outputChannel.appendLine(
                      `Retrieving compute results (${result.index + 1}/${resultsLength})...`
                    )
                    const filePathLogs = await getAndSaveLogs(
                      config,
                      jobId,
                      result.index,
                      result.filename,
                      resultsFolderPath,
                      progress
                    )

                    if (result.filename.toLowerCase().includes('algorithm')) {
                      const logContent = await fs.promises.readFile(filePathLogs, 'utf-8')
                      computeLogsChannel.appendLine(logContent)
                    }
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
                    progress.report({ message: 'Error saving the output result' })
                    outputChannel.appendLine('Error saving the output result')
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

async function handleFailureLogsRetrieval(
  config: SelectedConfig,
  jobId: string,
  status: any,
  resultsFolderPath: string,
  computeLogsChannel: vscode.OutputChannel,
  progress: vscode.Progress<{ message?: string }>
) {
  if (!status.results || status.results.length === 0) {
    return
  }

  computeLogsChannel.appendLine(`Job failed with status: ${status.statusText}\n`)
  const resultsWithoutArchive = status.results.filter(
    (result) => !result.filename.includes('.tar')
  )

  for (const result of resultsWithoutArchive) {
    try {
      const filePathLogs = await getAndSaveLogs(
        config,
        jobId,
        result.index,
        result.filename,
        resultsFolderPath,
        progress
      )

      const logContent = await fs.promises.readFile(filePathLogs, 'utf-8')
      computeLogsChannel.appendLine(`\n=== ${result.filename} ===\n${logContent}`)
    } catch (logError) {
      console.error('Could not retrieve log:', logError)
    }
  }

  computeLogsChannel.show(true)
}

async function getAndSaveLogs(
  config: SelectedConfig,
  jobId: string,
  index: number,
  fileName: string,
  resultsFolderPath: string,
  progress: vscode.Progress<{ message?: string }>
) {
  const imageResult = await withRetrial(
    () => getComputeResult(config, jobId, index),
    progress
  )

  progress.report({ message: `Saving ${fileName}...` })
  const filePathLogs = await saveResults(imageResult, resultsFolderPath, fileName)
  outputChannel.appendLine(`${fileName} saved to: ${filePathLogs}`)
  return filePathLogs
}
