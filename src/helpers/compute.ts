import * as vscode from 'vscode'
import { Signer } from 'ethers'
import fs from 'fs'
import path from 'path'
import * as tar from 'tar'
import {
  ComputeAlgorithm,
  ComputeAsset,
  ComputeJob,
  FileObjectType,
  ProviderInstance
} from '@oceanprotocol/lib'
import { PassThrough } from 'stream'
import { fetchDdoByDid } from './indexer'


const getContainerConfig = (
  fileExtension: string,
  dockerImage?: string,
  dockerTag?: string
) => {
  if (dockerImage && dockerTag) {
    return {
      image: dockerImage,
      tag: dockerTag,
      entrypoint: fileExtension === 'py' ? 'python $ALGO' : 'node $ALGO'
    }
  }

  switch (fileExtension) {
    case 'py':
      return {
        entrypoint: 'python $ALGO',
        image: 'oceanprotocol/c2d_examples',
        tag: 'py-general'
      }
    case 'js':
      return {
        entrypoint: 'node $ALGO',
        image: 'oceanprotocol/c2d_examples',
        tag: 'js-general'
      }
    default:
      throw new Error('File extension not supported')
  }
}

export const getComputeAsset = async (nodeUrl: string, dataset?: string) => {
  try {
    if (!dataset) {
      return []
    }

    const isDatasetDid = dataset?.startsWith('did:')
    if (isDatasetDid) {
      const ddo = await fetchDdoByDid(nodeUrl, dataset)
      return [{ documentId: dataset, serviceId: ddo.services[0].id }]
    }

    const isDatasetUrl = dataset?.startsWith('http')
    if (isDatasetUrl) {
      return [{ fileObject: { type: FileObjectType.URL, url: dataset, method: 'GET' } }]
    }

    const isDatasetIpfs = dataset?.startsWith('Qm')
    if (isDatasetIpfs) {
      return [{ fileObject: { type: FileObjectType.IPFS, hash: dataset } }]
    }

    const arweaveUrl = `https://arweave.net/${dataset}`
    const isDatasetUnknownArweave = await fetch(arweaveUrl)
    if (isDatasetUnknownArweave.status === 200) {
      return [{ fileObject: { type: FileObjectType.URL, url: arweaveUrl, method: 'GET' } }]
    }

    const ipfsUrl = `https://ipfs.io/ipfs/${dataset}`
    const isDatasetUnknownIpfs = await fetch(ipfsUrl)
    if (isDatasetUnknownIpfs.status === 200) {
      return [{ fileObject: { type: FileObjectType.URL, url: ipfsUrl, method: 'GET' } }]
    }

    return []
  } catch (e) {
    return []
  }
}

export async function stopComputeJob(nodeUrl: string, jobId: string, signer: Signer) {
  try {
    const computeJob = await ProviderInstance.computeStop(jobId, nodeUrl, signer)
    return computeJob
  } catch (e) {
    console.log({ e })
    console.error('Stop compute job error: ', e)
    throw e
  }
}

export async function computeStart(
  algorithmContent: string,
  signer: Signer,
  nodeUrl: string,
  fileExtension: string,
  environmentId?: string,
  dataset?: string,
  dockerImage?: string,
  dockerTag?: string
): Promise<ComputeJob> {
  try {
    if (!environmentId) {
      throw new Error('No environment ID provided')
    }

    const containerConfig = getContainerConfig(fileExtension, dockerImage, dockerTag)

    const datasets = (await getComputeAsset(nodeUrl, dataset)) as ComputeAsset[]
    const algorithm: ComputeAlgorithm = {
      meta: {
        rawcode: algorithmContent,
        container: { ...containerConfig, checksum: '' }
      }
    }

    const computeJob = await ProviderInstance.freeComputeStart(
      nodeUrl,
      signer,
      environmentId,
      datasets,
      algorithm
    )

    const result = Array.isArray(computeJob) ? computeJob[0] : computeJob
    return result
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
  consumerAddress: string,
  jobId: string
): Promise<ComputeJob> {
  try {
    const computeStatus = await ProviderInstance.computeStatus(
      nodeUrl,
      consumerAddress,
      jobId
    )

    return Array.isArray(computeStatus) ? computeStatus[0] : computeStatus
  } catch (error) {
    throw new Error('Failed to check compute status')
  }
}

export async function getComputeResult(
  signer: Signer,
  nodeUrl: string,
  jobId: string,
  index: number = 0
): Promise<any> {
  try {
    const computResultUrl = await ProviderInstance.getComputeResultUrl(
      nodeUrl,
      signer,
      jobId,
      index
    )

    const response = await fetch(computResultUrl)
    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return buffer
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

    // Write the file
    await fs.promises.writeFile(filePath, results, 'utf-8')

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
  signer: Signer,
  jobId: string,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  try {
    outputChannel.show(true)
    const stream = (await ProviderInstance.computeStreamableLogs(
      nodeUrl,
      signer,
      jobId
    )) as PassThrough

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

    // // Save the tar file
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

export async function getComputeEnvironments(nodeUrl: string) {
  const environments = await ProviderInstance.getComputeEnvironments(nodeUrl)
  if (!environments || environments.length === 0) {
    throw new Error('No compute environments available')
  }

  return environments
}

export async function withRetrial<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
  progress?: vscode.Progress<{ message?: string }>
): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt === maxRetries - 1) {
        throw lastError
      }

      const retryDelay = delay * Math.pow(2, attempt)
      if (progress) {
        progress.report({ message: `Attempt ${attempt + 1} failed. Retry in ${retryDelay}ms...` })
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }

  throw lastError!
}
