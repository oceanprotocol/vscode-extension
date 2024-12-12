import * as vscode from 'vscode'
import { Signer } from 'ethers'
import fs from 'fs'
import axios from 'axios'
import path from 'path'

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
  dataset: any,
  algorithm: any,
  signer: Signer,
  nodeUrl: string,
  nonce: number = 1
): Promise<ComputeResponse> {
  console.log('Starting free compute job using provider: ', nodeUrl)
  const consumerAddress: string = await signer.getAddress()

  try {
    console.log('Sending compute request with body:', {
      command: 'freeStartCompute',
      consumerAddress: consumerAddress,
      nonce: nonce,
      signature: '0x123',
      datasets: [dataset],
      algorithm: algorithm
    })

    const response = await axios.post(`${nodeUrl}/directCommand`, {
      command: 'freeStartCompute',
      consumerAddress: consumerAddress,
      nonce: nonce,
      signature: '0x123',
      datasets: [dataset],
      algorithm: algorithm
    })

    console.log('Free Start Compute response: ' + JSON.stringify(response.data))

    if (!response.data || response.data.length === 0) {
      throw new Error('Empty response from compute start')
    }

    return response.data[0]
  } catch (e) {
    console.error('Free start compute error: ', e)
    // Log additional error details if available
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
  destinationFolder: string
): Promise<string> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `compute-results-${timestamp}.txt`
    const filePath = path.join(destinationFolder, fileName)

    await fs.promises.writeFile(filePath, JSON.stringify(results, null, 2), 'utf-8')
    return filePath
  } catch (error) {
    console.error('Error saving results:', error)
    throw error
  }
}

// Create output channel for compute logs
export const computeLogsChannel = vscode.window.createOutputChannel('Ocean Compute Logs')

export async function getComputeLogs(
  nodeUrl: string,
  jobId: string,
  consumerAddress: string,
  nonce: number,
  signature: string
): Promise<void> {
  try {
    // Make request to get compute logs
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

    if (!response.ok) {
      throw new Error(`Failed to get compute logs: ${response.statusText}`)
    }

    const logs = await response.json()
    if (logs && Array.isArray(logs)) {
      logs.forEach((log) => {
        computeLogsChannel.appendLine(log)
      })
    }
  } catch (error) {
    console.error('Error fetching compute logs:', error)
  }
}
