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
  getDefaultResourcesFromFreeEnv,
  getComputeLogs,
  getComputeResult,
  saveOutput,
  saveResults,
  streamToString,
  stopComputeJob,
  withRetrial
} from './helpers/compute'
import { validateDatasetFromInput } from './helpers/validation'
import { SelectedConfig } from './types'
import { ethers, Signer } from 'ethers'
import { checkAndReadFile, listDirectoryContents } from './helpers/path'
import { DEFAULT_MULTIADDR } from './helpers/p2p'
import { ProviderInstance } from '@oceanprotocol/lib'
import {
  initAnalytics,
  identifyUser,
  trackEvent,
  trackP2PError,
  shutdownAnalytics
} from './helpers/analytics'
import { randomUUID } from 'crypto'

// @oceanprotocol/lib bundles libp2p's browser user-agent helper which reads
// globalThis.navigator.userAgent. VSCode's extension host defines `navigator`
// as a getter that returns undefined (plain assignment throws "only a getter"),
// so we must redefine the property. Without this any P2P call throws
// "Cannot read properties of undefined (reading 'userAgent')".
if (!(globalThis as any).navigator?.userAgent) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'ocean-vscode-extension' },
    writable: true,
    configurable: true
  })
}

globalThis.fetch = fetch

const outputChannel = vscode.window.createOutputChannel('Ocean Orchestrator')
let config: SelectedConfig = new SelectedConfig({
  isFreeCompute: true,
  multiaddresses: [DEFAULT_MULTIADDR]
})
let provider: OceanProtocolViewProvider
let firstStartup = true
let anonymousId: string
let globalContext: vscode.ExtensionContext | undefined

vscode.window.registerUriHandler({
  handleUri(uri: vscode.Uri) {
    const urlParams = new URLSearchParams(uri.query)
    const authToken = urlParams.get('authToken')
    const multiaddresses = urlParams.get('multiaddresses')
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
      multiaddresses: multiaddresses ? multiaddresses.split(',') : [DEFAULT_MULTIADDR],
      isFreeCompute: isFreeComputeBoolean,
      environmentId,
      feeToken,
      jobDuration,
      resources: resourcesParsed,
      chainId: chainIdNumber
    })
    ProviderInstance.setupP2P({ bootstrapPeers: config.multiaddresses }).catch(
      (e) => {
        console.error(e)
        trackP2PError(config.address || anonymousId, e, 'setupP2P_uriHandler', {
          multiaddr_count: config.multiaddresses?.length
        })
      }
    )
    console.log({ config })

    if (address) {
      identifyUser(address)
    }
    const configCount = (globalContext!.globalState.get<number>('configCount') ?? 0) + 1
    globalContext!.globalState.update('configCount', configCount)
    trackEvent(address || anonymousId, 'ide_config_received', {
      environment_id: environmentId,
      is_free_compute: isFreeComputeBoolean,
      chain_id: chainIdNumber,
      has_auth_token: !!authToken,
      config_count: configCount
    })

    // Update the UI with the new values
    provider?.notifyConfigUpdate(config)
  }
})

export async function activate(context: vscode.ExtensionContext) {
  let savedSigner: Signer | null = null
  let savedJobId: string | null = null
  const completedJobs = new Map<
    string,
    {
      archiveIndex: number
      archiveSize: number
      resultsFolderPath: string
      downloadCount: number
      logResults: Array<{ index: number; filename: string }>
    }
  >()

  globalContext = context

  anonymousId = context.globalState.get<string>('anonymousId') ?? ''
  if (!anonymousId) {
    anonymousId = randomUUID()
    context.globalState.update('anonymousId', anonymousId)
  }

  initAnalytics()

  const hasTrackedInstall = context.globalState.get<boolean>('hasTrackedInstall')
  if (!hasTrackedInstall) {
    trackEvent(anonymousId, 'extension_installed', {
      version: context.extension.packageJSON.version,
      ide: vscode.env.appName
    })
    context.globalState.update('hasTrackedInstall', true)
  }

  ProviderInstance.setupP2P({
    bootstrapPeers: config.multiaddresses
  }).catch((e) => {
    console.error(e)
    trackP2PError(anonymousId, e, 'setupP2P_activate', {
      multiaddr_count: config.multiaddresses?.length
    })
  })

  outputChannel.show()
  outputChannel.appendLine('Ocean Orchestrator is now active!')
  console.log('Ocean Orchestrator is now active!')

  try {
    // Create and register the webview provider
    provider = new OceanProtocolViewProvider((event, props) =>
      trackEvent(anonymousId, event, props)
    )
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
      vscode.commands.registerCommand('ocean-protocol.getEnvironments', async () => {
        let environments
        try {
          environments = await getComputeEnvironments(config.multiaddresses)
        } catch (e) {
          trackP2PError(config.address || anonymousId, e, 'getComputeEnvironments')
          throw e
        }
        // If it's the first startup, set the default resources and job duration
        if (firstStartup && Array.isArray(environments) && environments.length > 0) {
          const env =
            environments.find((e: { id?: string }) => e.id === config.environmentId) ??
            environments[0]
          config.updateFields({
            environmentId: config.environmentId || env.id,
            resources: getDefaultResourcesFromFreeEnv(env),
            jobDuration: String(env?.free?.maxJobDuration ?? 7200)
          })
          provider?.notifyConfigUpdate(config)
          firstStartup = false
        }

        return environments
      })
    )

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'ocean-protocol.validateDataset',
        async (input: string) => {
          return await validateDatasetFromInput(config.multiaddresses, input)
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
            await stopComputeJob(
              config.multiaddresses,
              savedJobId,
              authToken || savedSigner
            )
            trackEvent(config.address!, 'compute_job_stopped', {
              job_id: savedJobId
            })
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
        dataset?: string,
        dockerImage?: string,
        dockerTag?: string,
        environmentId?: string
      ) => {
        console.log('1. Starting compute job...')
        console.log('Dataset:', dataset)
        console.log('Algorithm path:', algorithmPath)
        console.log('Results folder path:', resultsFolderPath)
        console.log('Auth token:', authToken)
        console.log('Docker image:', dockerImage)
        console.log('Docker tag:', dockerTag)
        console.log('Environment ID:', environmentId)
        const missingParams = []
        !algorithmPath && missingParams.push('algorithm path')

        if (missingParams.length > 0) {
          vscode.window.showErrorMessage(
            `Missing required parameters: ${missingParams.join(', ')}`
          )
          return
        }

        let signer: ethers.HDNodeWallet
        if (!authToken || authToken === '') {
          try {
            if (!savedSigner) {
              signer = ethers.Wallet.createRandom()
              savedSigner = signer
              console.log('Generated new wallet address:', signer.address)
              vscode.window.showInformationMessage(
                `Using generated wallet with address: ${signer.address}`
              )
            } else {
              signer = savedSigner as ethers.HDNodeWallet
              console.log('Reusing existing wallet address:', signer.address)
            }
            // Always generate a fresh auth token (tokens can expire)
            authToken = await generateAuthToken(config.multiaddresses, signer)
            config.updateFields({ address: signer.address })
          } catch (error) {
            console.log(error)
            trackP2PError(config.address || anonymousId, error, 'generateAuthToken')
            vscode.window.showErrorMessage(
              'Error generating auth token. Please make sure you selected a valid node'
            )
            return
          }
        }

        // Update back the config with new values from the extension
        config.updateFields({ authToken, environmentId })
        provider.sendMessage({ type: 'jobLoading' })

        trackEvent(config.address!, 'compute_job_started', {
          is_free_compute: config.isFreeCompute,
          environment_id: config.environmentId,
          has_dataset: !!dataset,
          has_custom_docker: !!dockerImage,
          algorithm_language: algorithmPath.split('.').pop()?.toLowerCase()
        })

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

            trackEvent(config.address!, 'compute_job_created', {
              is_free_compute: config.isFreeCompute,
              environment_id: config.environmentId,
              job_id: jobId
            })

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
                trackEvent(config.address!, 'compute_job_failed', {
                  is_free_compute: config.isFreeCompute,
                  environment_id: config.environmentId,
                  job_id: jobId,
                  error: 'OOMKilled'
                })
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

                trackEvent(config.address!, 'compute_job_failed', {
                  is_free_compute: config.isFreeCompute,
                  environment_id: config.environmentId,
                  job_id: jobId,
                  error: status.statusText
                })
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

                  if (completedJobs.size >= 50) {
                    completedJobs.delete(completedJobs.keys().next().value!)
                  }
                  completedJobs.set(jobId, {
                    archiveIndex: archive?.index ?? 0,
                    archiveSize: archive?.filesize ?? 0,
                    resultsFolderPath,
                    downloadCount: 0,
                    logResults: resultsWithoutArchive.map((r) => ({
                      index: r.index,
                      filename: r.filename
                    }))
                  })
                  trackEvent(config.address!, 'compute_job_completed', {
                    is_free_compute: config.isFreeCompute,
                    environment_id: config.environmentId,
                    job_id: jobId
                  })
                  savedJobId = null
                  provider.sendMessage({ type: 'jobCompleted', jobId })
                  vscode.window.showInformationMessage(
                    'Job finished. Download results from the Download Results section.'
                  )
                  outputChannel.appendLine(
                    'Job finished. Download results from the Download Results section.'
                  )

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

          trackEvent(config.address!, 'compute_job_failed', {
            is_free_compute: config.isFreeCompute,
            environment_id: config.environmentId,
            job_id: savedJobId,
            error: error instanceof Error ? error.message : String(error)
          })

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

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'ocean-protocol.downloadResults',
        async (jobId: string) => {
          const job = completedJobs.get(jobId)
          if (!job) {
            vscode.window.showErrorMessage('Job results not found in this session.')
            return
          }
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: 'Downloading Results',
              cancellable: true
            },
            async (progress, token) => {
              const abortController = new AbortController()
              token.onCancellationRequested(() => abortController.abort())

              progress.report({ message: '0%' })
              let lastIncrement = 0
              const onDownloadProgress =
                job.archiveSize > 0
                  ? (bytesWritten: number, totalBytes: number) => {
                      const pct = Math.min(
                        100,
                        Math.floor((bytesWritten / totalBytes) * 100)
                      )
                      progress.report({
                        message: `${pct}%`,
                        increment: pct - lastIncrement
                      })
                      lastIncrement = pct
                    }
                  : undefined
              try {
                const totalFiles = job.logResults.length + 1
                let filesDone = 0

                for (const log of job.logResults) {
                  if (abortController.signal.aborted) break
                  progress.report({ message: `Logs (${++filesDone}/${totalFiles})...` })
                  await getAndSaveLogs(
                    config,
                    jobId,
                    log.index,
                    log.filename,
                    job.resultsFolderPath
                  )
                }

                if (!abortController.signal.aborted) {
                  job.downloadCount += 1
                  const prefix =
                    job.downloadCount === 1
                      ? 'result-output'
                      : `result-output(${job.downloadCount})`
                  const filePath = await saveOutput(
                    config,
                    jobId,
                    job.archiveIndex,
                    job.resultsFolderPath,
                    prefix,
                    onDownloadProgress,
                    job.archiveSize > 0 ? job.archiveSize : undefined,
                    abortController.signal
                  )
                  outputChannel.appendLine(`Results saved to: ${filePath}`)
                  vscode.window.showInformationMessage(
                    'Outputs available in results folder.'
                  )
                }
              } catch (error) {
                if (abortController.signal.aborted) {
                  outputChannel.appendLine('Download cancelled.')
                } else {
                  throw error
                }
              }
            }
          )
        }
      )
    )
  } catch (error) {
    console.error('Error during extension activation:', error)
    outputChannel.appendLine(`Error during extension activation: ${error}`)
  }
}

// Add deactivation handling
export async function deactivate() {
  console.log('Ocean Orchestrator is being deactivated')
  outputChannel.appendLine('Ocean Orchestrator is being deactivated')
  await shutdownAnalytics()
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
  progress?: vscode.Progress<{ message?: string }>
) {
  const result = await withRetrial(() => getComputeResult(config, jobId, index), progress)

  progress?.report({ message: `Saving ${fileName}...` })
  const content = await streamToString(result)
  const filePathLogs = await saveResults(
    content,
    path.join(resultsFolderPath, jobId),
    fileName
  )
  outputChannel.appendLine(`${fileName} saved to: ${filePathLogs}`)
  return filePathLogs
}
