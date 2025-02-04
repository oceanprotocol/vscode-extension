import * as vscode from 'vscode'
import { Signer } from 'ethers'
import fs from 'fs'
import axios from 'axios'
import path from 'path'
import { PassThrough } from 'stream'

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
  algorithm: any,
  signer: Signer,
  nodeUrl: string,
  dataset?: any,
  nonce: number = 1
): Promise<ComputeResponse> {
  console.log('Starting free compute job using provider: ', nodeUrl)
  const consumerAddress: string = await signer.getAddress()

  try {
    const requestBody = {
      command: 'freeStartCompute',
      consumerAddress: consumerAddress,
      environment:
        '0x2208d1490d4e69c3237ac3258fcef6e4092971963ada7dcd96c112f8c0fea01a-0x3841ed3051c274d23bd735d46228ceb94cb67ca692a31d9c29e61b4e0a8b755a',
      nonce: nonce,
      signature: '0x123',
      datasets: dataset ? [dataset] : [],
      algorithm: {
        meta: {
          rawcode: `
          // Constants for timing (in milliseconds)
          const TOTAL_DURATION = 10 * 1000; // 10 seconds
          const LOG_INTERVAL = 1000; // 1 second

          // Function to run the logging
          async function runLogging() {
            console.log('RAW CODE: Starting logging process...');

            const startTime = Date.now();
            let currentIteration = 1;

            return new Promise((resolve) => {
              const intervalId = setInterval(() => {
                const elapsedTime = Date.now() - startTime;

                console.log(
                  \`Log iteration \${currentIteration}: \${elapsedTime / 1000} seconds elapsed\`
                );
                currentIteration++;

                if (elapsedTime >= TOTAL_DURATION) {
                  clearInterval(intervalId);
                  console.log('Completed');
                  resolve('completed');
                }
              }, LOG_INTERVAL);
            });
          }

          // Run the logging function
          runLogging();
          `,
          container: {
            entrypoint: 'node $ALGO',
            image: 'node',
            tag: 'latest'
          }
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
    return response.data
  } catch (error) {
    console.error('Error getting compute result:', error)
    throw error
  }
}

export async function saveResults(
  results: any,
  destinationFolder?: string
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
    const fileName = `compute-results-${timestamp}.txt`
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
