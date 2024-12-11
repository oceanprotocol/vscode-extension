import { ProviderInstance } from '@oceanprotocol/lib'
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

export async function computeStart(
  dataset: any,
  algorithm: any,
  signer: Signer,
  nodeUrl: string
) {
  console.log('Starting free compute job using provider: ', nodeUrl)
  const consumerAddress: string = await signer.getAddress()

  const nonce = (await ProviderInstance.getNonce(nodeUrl, await signer.getAddress())) + 1
  console.log('Nonce: ', nonce)

  try {
    const response = await fetch(nodeUrl + '/directCommand', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        command: 'freeStartCompute',
        consumerAddress: consumerAddress,
        nonce: nonce,
        signature: '0x123',
        datasets: [dataset],
        algorithm: algorithm
      })
    })
    console.log('Free Start Compute response: ' + JSON.stringify(response))
  } catch (e) {
    console.error('Free start compute error: ', e)
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
  nonce: number = 1
) {
  const response = await axios.post(`${nodeUrl}/directCommand`, {
    command: 'getComputeResult',
    jobId,
    consumerAddress,
    signature,
    index,
    nonce
  })
  return response.data
}

export async function saveResults(results: any): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `compute-results-${timestamp}.txt`
  const filePath = path.join(process.cwd(), fileName)

  await fs.promises.writeFile(filePath, JSON.stringify(results, null, 2), 'utf-8')
  return filePath
}
