import * as vscode from 'vscode'
import { Signer } from 'ethers'
import fs from 'fs'
import axios from 'axios'
import path from 'path'
import { PassThrough } from 'stream'
import * as tar from 'tar'
import * as os from 'os'

interface ComputeStatus {
  owner: string
  jobId: string
  dateCreated: string
  dateFinished: string | null
  status: number
  statusText: string
  results: Array<{
    filename: string
    filesize: number
    type: string
    index: number
  }>
}

interface ComputeResponse {
  owner: string
  jobId: string
  dateCreated: string
  dateFinished: null
  status: number
  statusText: string
  results: any[]
  agreementId: string
  expireTimestamp: number
  environment: string
}

export async function computeStart(
  algorithmContent: string,
  signer: Signer,
  nodeUrl: string,
  fileExtension: string,
  dataset?: any,
  nonce: number = 1,
  dockerImage?: string,
  dockerTag?: string
): Promise<ComputeResponse> {
  console.log('Starting free compute job using provider: ', nodeUrl)
  console.log('Docker image:', dockerImage)
  console.log('Docker tag:', dockerTag)
  const consumerAddress: string = await signer.getAddress()

  // Fetch compute environments first
  try {
    const envResponse = await axios.get(`${nodeUrl}/api/services/computeEnvironments`)
    if (!envResponse.data || !envResponse.data.length) {
      throw new Error('No compute environments available')
    }
    const environmentId = envResponse.data[0].id
    console.log('Using compute environment:', environmentId)

    // Determine container config based on file extension
    const containerConfig =
      fileExtension === 'py'
        ? {
            image: dockerImage || 'oceanprotocol/algo_dockers',
            tag: dockerTag || 'python-branin',
            entrypoint: 'python $ALGO',
            termsAndConditions: true
          }
        : {
            entrypoint: 'node $ALGO',
            image: dockerImage || 'node',
            tag: dockerTag || 'latest'
          }

    const requestBody = {
      command: 'freeStartCompute',
      consumerAddress: consumerAddress,
      environment: environmentId,
      nonce: nonce,
      signature: '0x123',
      datasets: dataset ? [dataset] : [],
      algorithm: {
        meta: {
          rawcode: algorithmContent,
          container: containerConfig
        }
      }
    }

    console.log('Sending compute request with body:', requestBody)

    const response = await axios.post(`${nodeUrl}/directCommand`, requestBody)

    console.log('Free Start Compute response: ' + JSON.stringify(response.data))

    if (!response.data || response.data.length === 0) {
      throw new Error('Empty response from compute start')
    }

    return response.data[0]
  } catch (e) {
    console.error('Free start compute error: ', e)
    if (e.response) {
      console.error('Error response data:', e.response.data)
      console.error('Error response status:', e.response.status)
      console.error('Error response headers:', e.response.headers)
    }
    throw e
  }
}

export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function checkComputeStatus(
  nodeUrl: string,
  jobId: string
): Promise<ComputeStatus> {
  const response = await axios.post(`${nodeUrl}/directCommand`, {
    command: 'getComputeStatus',
    jobId
  })
  return response.data[0]
}

export async function getComputeResult(
  nodeUrl: string,
  jobId: string,
  consumerAddress: string,
  signature: string,
  index: number = 0,
  nonce: number = 0
) {
  try {
    console.log('Getting compute result for jobId:', jobId)
    console.log('Using consumerAddress:', consumerAddress)
    console.log('Using signature:', signature)
    console.log('Using index:', index)
    console.log('Using nonce:', nonce)

    const response = await axios.post(`${nodeUrl}/directCommand`, {
      command: 'getComputeResult',
      jobId,
      consumerAddress,
      signature,
      index,
      nonce
    })
    console.log('Compute result response:', response)
    console.log('Compute result data:', response.data)
    return response.data
  } catch (error) {
    console.error('Error getting compute result:', error)
    throw error
  }
}

export async function saveResults(
  results: any,
  destinationFolder?: string,
  prefix: string = 'result'
): Promise<string> {
  try {
    // Use provided destination folder or default to './results'
    const resultsDir = destinationFolder || path.join(process.cwd(), 'results')

    // Ensure results directory exists
    if (!fs.existsSync(resultsDir)) {
      console.log('Creating results directory at:', resultsDir)
      await fs.promises.mkdir(resultsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `${prefix}-${timestamp}.txt`
    const filePath = path.join(resultsDir, fileName)

    console.log('Saving results to:', filePath)

    // Format the results string to handle new lines properly
    const formattedResults =
      typeof results === 'string'
        ? results.replace(/\\n/g, '\n')
        : JSON.stringify(results, null, 2)

    // Write the file
    await fs.promises.writeFile(filePath, formattedResults, 'utf-8')

    // Verify file was created
    if (!fs.existsSync(filePath)) {
      throw new Error(`Failed to create file at ${filePath}`)
    }

    return filePath
  } catch (error) {
    console.error('Error saving results:', error)
    console.error('Results directory:', destinationFolder || './results')
    console.error('Results:', results)
    throw new Error(`Failed to save results: ${error.message}`)
  }
}

export async function getComputeLogs(
  nodeUrl: string,
  jobId: string,
  consumerAddress: string,
  nonce: number,
  signature: string,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  try {
    outputChannel.show(true)

    const response = await fetch(`${nodeUrl}/directCommand`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        command: 'getComputeStreamableLogs',
        jobId,
        consumerAddress,
        nonce,
        signature
      })
    })

    if (response.ok) {
      console.log('Response: ', response)
      console.log('Response body: ', response.body)
      outputChannel.show(true)
    } else {
      console.log(`No algorithm logs available yet: ${response.statusText}`)
      return
    }

    const stream = response.body as unknown as PassThrough
    stream.on('data', (chunk) => {
      const text = chunk.toString('utf8')
      outputChannel.append(text)
    })

    stream.on('end', () => {
      console.log('Stream complete')
    })

    stream.on('error', (error) => {
      console.error('Stream error:', error)
      throw error
    })
  } catch (error) {
    console.error('Error fetching compute logs:', error)
    throw error
  }
}

/**
 * Saves the output from the second request (index=1) as a tar file and extracts its contents
 * @param content The tar file content (Buffer or string)
 * @param folderPath The folder to save the tar file and extracted contents
 * @param prefix Prefix for the filename
 * @returns The path to the saved tar file and extraction directory
 */
export async function saveOutput(
  content: Buffer | string,
  destinationFolder: string,
  prefix: string = 'output'
): Promise<string> {
  try {
    console.log('Content:', content)
    // Use provided destination folder or default to './results'
    const resultsDir = destinationFolder || path.join(process.cwd(), 'results')

    // Create timestamp for unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `${prefix}_${timestamp}.tar`
    console.log('File name:', fileName)
    const filePath = path.join(resultsDir, fileName)
    console.log('File path:', filePath)
    // Ensure the folder exists
    await fs.promises.mkdir(resultsDir, { recursive: true })

    // Convert string to Buffer if needed
    const tarContent =
      typeof content === 'string' ? Buffer.from(content, 'binary') : content

    // Save the tar file
    await fs.promises.writeFile(filePath, new Uint8Array(tarContent))
    console.log(`Tar file saved to: ${filePath}`)

    // Create extraction directory
    const extractDir = path.join(destinationFolder, `${prefix}_${timestamp}_extracted`)
    await fs.promises.mkdir(extractDir, { recursive: true })

    // Extract the tar contents
    try {
      await tar.x({
        file: filePath,
        cwd: extractDir,
        preservePaths: true
      })
      console.log(`Extracted contents to: ${extractDir}`)

      // Return both paths
      return filePath
    } catch (extractError) {
      console.error('Error extracting tar contents:', extractError)
      return filePath // Return just the tar path if extraction fails
    }
  } catch (error) {
    console.error('Error saving tar output:', error)
    throw new Error(`Failed to save tar output: ${error.message}`)
  }
}
