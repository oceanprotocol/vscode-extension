import * as vscode from 'vscode'
import { OceanProtocolViewProvider } from './viewProvider'
import { ethers } from 'ethers'
import * as fs from 'fs'
import fetch from 'cross-fetch'
import { OceanP2P } from './helpers/oceanNode'
import {
  checkComputeStatus,
  computeLogsChannel,
  computeStart,
  delay,
  getComputeLogs,
  getComputeResult,
  saveResults
} from './helpers/freeCompute'
import { generateOceanSignature } from './helpers/signature'

globalThis.fetch = fetch
const node = new OceanP2P()

const outputChannel = vscode.window.createOutputChannel('Ocean Protocol')

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

  const nodeId = await startOceanNode()

  const provider = new OceanProtocolViewProvider(context.extensionUri, nodeId)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      OceanProtocolViewProvider.viewType,
      provider
    )
  )

  let startComputeJob = vscode.commands.registerCommand(
    'ocean-protocol.startComputeJob',
    async (
      config: any,
      datasetPath: string,
      algorithmPath: string,
      resultsFolderPath: string,
      privateKey: string,
      nodeUrl: string
    ) => {
      console.log('Starting compute job...')
      console.log('Config:', config)
      console.log('Dataset path:', datasetPath)
      console.log('Algorithm path:', algorithmPath)
      console.log('Results folder path:', resultsFolderPath)
      console.log('Private key:', privateKey)
      console.log('Node URL:', nodeUrl)
      if (!config || !privateKey || !datasetPath || !algorithmPath || !nodeUrl) {
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
          const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl)
          console.log('Provider started')
          const signer = new ethers.Wallet(privateKey, provider)
          console.log('Signer created')

          // Read files
          const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'))
          console.log('Dataset read successfully')
          const algorithm = JSON.parse(fs.readFileSync(algorithmPath, 'utf8'))
          console.log('Algorithm read successfully')

          // nonce equals date in milliseconds
          const nonce = Date.now()
          console.log('Nonce: ', nonce)

          // Start compute job
          const computeResponse = await computeStart(
            dataset,
            algorithm,
            signer,
            nodeUrl,
            nonce
          )
          console.log('Compute result received:', computeResponse)
          const jobId = computeResponse.jobId
          console.log('Job ID:', jobId)

          computeLogsChannel.show()
          computeLogsChannel.appendLine(`Starting compute job with ID: ${jobId}`)

          // Start fetching logs periodically

          const index = 0

          console.log('Generating signature for retrieval...')
          progress.report({ message: 'Generating signature for retrieval...' })
          computeLogsChannel.appendLine('Generating signature for retrieval...')
          const signatureResult = await generateOceanSignature({
            privateKey,
            consumerAddress: signer.address,
            jobId,
            index,
            nonce
          })

          const logInterval = setInterval(async () => {
            await getComputeLogs(
              nodeUrl,
              jobId,
              signer.address,
              nonce,
              signatureResult.signature
            )
          }, 5000)

          // Monitor job status
          progress.report({ message: 'Monitoring compute job status...' })
          computeLogsChannel.appendLine('Monitoring compute job status...')

          while (true) {
            console.log('Checking job status...')
            const status = await checkComputeStatus(nodeUrl, jobId)
            console.log('Job status:', status)
            console.log('Status text:', status.statusText)
            progress.report({ message: `${status.statusText}` })
            computeLogsChannel.appendLine(`Job status: ${status.statusText}`)

            if (status.statusText === 'Job finished') {
              // Clear the logging interval
              clearInterval(logInterval)
              // Generate signature for result retrieval

              // Retrieve results
              progress.report({ message: 'Retrieving compute results...' })
              computeLogsChannel.appendLine('Retrieving compute results...')
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
              computeLogsChannel.appendLine('Saving results...')
              const filePath = await saveResults(results, resultsFolderPath)

              vscode.window.showInformationMessage(
                `Compute job completed successfully! Results saved to: ${filePath}`
              )
              computeLogsChannel.appendLine(
                `Compute job completed successfully! Results saved to: ${filePath}`
              )

              // Open the saved file in a new editor window
              const uri = vscode.Uri.file(filePath)
              const document = await vscode.workspace.openTextDocument(uri)
              await vscode.window.showTextDocument(document, { preview: false })

              vscode.window.showInformationMessage(
                `Compute job completed successfully! Results opened in editor.`
              )
              computeLogsChannel.appendLine(
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
}
