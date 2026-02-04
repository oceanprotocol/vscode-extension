import * as vscode from 'vscode'
import fs from 'fs'
import path from 'path'
import * as tar from 'tar'
import {
  ComputeAlgorithm,
  ComputeAsset,
  ComputeJob,
  FileObjectType
} from '@oceanprotocol/lib'
import { fetchDdoByDid } from './indexer'
import { SelectedConfig } from '../types'
import { Signer } from 'ethers'
import { ExtendedMetadataAlgorithm } from '@oceanprotocol/lib'
import { P2PCommand } from './p2p'
import { getConsumerAddress, getSignature } from './auth'
import { PROTOCOL_COMMANDS } from '../enum'
import { once } from 'events'
import { Stream } from '@libp2p/interface'

const getContainerConfig = (
  fileExtension: string,
  dockerImage?: string,
  dockerTag?: string,
  dockerfile?: string,
  additionalDockerFiles?: {
    [key: string]: string
  }
): ExtendedMetadataAlgorithm['container'] => {
  if (dockerfile) {
    return {
      image: '',
      tag: '',
      entrypoint: fileExtension === 'py' ? 'python $ALGO' : 'node $ALGO',
      dockerfile,
      additionalDockerFiles,
      checksum: ''
    }
  }

  if (dockerImage) {
    return {
      image: dockerImage,
      tag: dockerTag || 'latest',
      entrypoint:
        fileExtension === 'py'
          ? 'python $ALGO'
          : fileExtension === 'js'
            ? 'node $ALGO'
            : '',
      dockerfile,
      additionalDockerFiles,
      checksum: ''
    }
  }

  switch (fileExtension) {
    case 'py':
      return {
        image: 'oceanprotocol/c2d_examples',
        tag: 'py-general',
        entrypoint: 'python $ALGO',
        dockerfile,
        additionalDockerFiles,
        checksum: ''
      }
    case 'js':
      return {
        image: 'oceanprotocol/c2d_examples',
        tag: 'js-general',
        entrypoint: 'node $ALGO',
        dockerfile,
        additionalDockerFiles,
        checksum: ''
      }
    default:
      throw new Error(
        'Cannot start job. Do you have a .py/.js file or a docker image in Setup section?'
      )
  }
}

export const getComputeAsset = async (
  multiaddresses: string[] | undefined,
  dataset?: string
) => {
  try {
    if (!dataset) {
      return []
    }

    const isDatasetDid = dataset?.startsWith('did:')
    if (isDatasetDid) {
      const ddo = await fetchDdoByDid(multiaddresses, dataset)
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
      return [
        { fileObject: { type: FileObjectType.URL, url: arweaveUrl, method: 'GET' } }
      ]
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

export async function stopComputeJob(
  multiaddresses: string[] | undefined,
  jobId: string,
  signerOrAuthToken: Signer | string | null
) {
  try {
    const consumerAddress = await getConsumerAddress(signerOrAuthToken)
    const nonce = await P2PCommand(PROTOCOL_COMMANDS.NONCE, multiaddresses, {
      address: consumerAddress
    })
    const signature = await getSignature(
      signerOrAuthToken,
      consumerAddress + (jobId || '')
    )

    const computeJob = await P2PCommand(
      PROTOCOL_COMMANDS.COMPUTE_STOP,
      multiaddresses,
      { jobId, consumerAddress, nonce, signature },
      signerOrAuthToken
    )
    return computeJob
  } catch (e) {
    console.error('Stop compute job error: ', e)
    throw e
  }
}

export async function computeStart(
  config: SelectedConfig,
  algorithmContent: string,
  fileExtension: string,
  dataset?: string,
  dockerImage?: string,
  dockerTag?: string,
  dockerfile?: string,
  additionalDockerFiles?: {
    [key: string]: string
  },
  envVars?: {
    [key: string]: string
  }
): Promise<ComputeJob> {
  try {
    const container = getContainerConfig(
      fileExtension,
      dockerImage,
      dockerTag,
      dockerfile,
      additionalDockerFiles
    )
    const datasets = (await getComputeAsset(
      config.multiaddresses,
      dataset
    )) as ComputeAsset[]
    const algorithm: ComputeAlgorithm = {
      meta: {
        rawcode: algorithmContent,
        container
      },
      envs: envVars
    }

    if (!config.environmentId) {
      throw new Error('No environment ID provided')
    }

    // Paid compute job
    if (!config.isFreeCompute) {
      console.log('----------> Paid compute job started')
      const consumerAddress = await getConsumerAddress(config.authToken)
      const nonce = await P2PCommand(
        PROTOCOL_COMMANDS.NONCE,
        config.multiaddresses,
        {
          address: consumerAddress
        }
      )
      const incrementedNonce = (nonce + 1).toString()

      let signatureMessage = consumerAddress
      signatureMessage += datasets[0]?.documentId
      signatureMessage += incrementedNonce

      const signature = await getSignature(config.authToken, signatureMessage)
      const computeJob = await P2PCommand(
        PROTOCOL_COMMANDS.COMPUTE_START,
        config.multiaddresses,
        {
          environment: config.environmentId,
          datasets,
          dataset: datasets[0],
          algorithm,
          maxJobDuration: Number(config.jobDuration),
          feeToken: config.feeToken,
          resources: config.resources,
          chainId: config.chainId,
          payment: {
            chainId: config.chainId,
            token: config.feeToken,
            resources: config.resources
          },
          consumerAddress,
          nonce: incrementedNonce,
          signature
        },
        config.authToken
      )

      return Array.isArray(computeJob) ? computeJob[0] : computeJob
    }

    const consumerAddress = await getConsumerAddress(config.authToken)
    const nonce = await P2PCommand(
      PROTOCOL_COMMANDS.NONCE,
      config.multiaddresses,
      {
        address: consumerAddress
      }
    )
    const incrementedNonce = (nonce + 1).toString()
    const signature = await getSignature(
      config.authToken,
      consumerAddress + incrementedNonce
    )
    const computeJob = await P2PCommand(
      PROTOCOL_COMMANDS.FREE_COMPUTE_START,
      config.multiaddresses,
      {
        environment: config.environmentId,
        datasets,
        dataset: datasets[0],
        algorithm,
        resources: config.resources,
        consumerAddress,
        nonce: incrementedNonce,
        signature
      },
      config.authToken
    )

    return Array.isArray(computeJob) ? computeJob[0] : computeJob
  } catch (e) {
    console.error('Free start compute error: ', e)
    if (e.response) {
      console.error('Error response data:', e.response.data)
      console.error('Error response status:', e.response.status)
      console.error('Error response headers:', e.response.headers)
      if (e.response?.status === 400) {
        throw new Error(e.response?.data?.message)
      }
    }

    throw e
  }
}

export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function checkComputeStatus(
  config: SelectedConfig,
  jobId: string
): Promise<ComputeJob> {
  try {
    const computeStatus = await P2PCommand(
      PROTOCOL_COMMANDS.COMPUTE_GET_STATUS,
      config.multiaddresses,
      { jobId },
      config.authToken
    )
    return Array.isArray(computeStatus) ? computeStatus[0] : computeStatus
  } catch (error) {
    throw new Error('Failed to check compute status')
  }
}

export async function getComputeResult(
  config: SelectedConfig,
  jobId: string,
  index: number = 0
): Promise<Stream> {
  try {
    const consumerAddress = await getConsumerAddress(config.authToken)
    const computeResult = await P2PCommand(
      PROTOCOL_COMMANDS.COMPUTE_GET_RESULT,
      config.multiaddresses,
      { jobId, index, consumerAddress },
      config.authToken
    )

    return computeResult
  } catch (error) {
    console.error('Error getting compute result:', error)
    throw error
  }
}

export async function streamToString(stream: Stream): Promise<string> {
  const decoder = new TextDecoder('utf-8')
  let result = ''
  for await (const chunk of stream) {
    result += decoder.decode(chunk.subarray(), { stream: true })
  }
  return result
}

export async function saveResults(
  results: any,
  destinationFolder?: string,
  prefix: string = 'result'
): Promise<string> {
  try {
    // Use provided destination folder or default to './results'
    const baseDir = destinationFolder || path.join(process.cwd(), 'results')
    const dateStr = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-')
    const resultsDir = path.join(baseDir, `results-${dateStr}`)
    const logsDir = path.join(resultsDir, 'logs')

    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      console.log('Creating logs directory at:', logsDir)
      await fs.promises.mkdir(logsDir, { recursive: true })
    }

    const fileName = `${prefix}.txt`
    const filePath = path.join(logsDir, fileName)

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
  config: SelectedConfig,
  jobId: string,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  try {
    outputChannel.show(true)
    const logs = await P2PCommand(
      PROTOCOL_COMMANDS.COMPUTE_GET_STREAMABLE_LOGS,
      config.multiaddresses,
      { jobId },
      config.authToken
    )

    const decoder = new TextDecoder('utf-8')
    for await (const chunk of logs) {
      outputChannel.append(decoder.decode(chunk.subarray(), { stream: true }))
    }
    console.log('Stream complete')
  } catch (error) {
    console.error('Error fetching compute logs:', error)
  }
}

/**
 * Saves the output stream as a tar file and extracts its contents.
 * Iterates directly over the stream chunks for maximum control and elegance.
 * @param contentStream The stream of data chunks (AsyncIterable<Uint8Array>)
 * @param destinationFolder The folder to save the tar file and extracted contents
 * @param prefix Prefix for the filename
 * @returns The path to the saved tar file
 */

export async function saveOutput(
  stream: Stream,
  destinationFolder: string,
  prefix: string = 'output'
): Promise<string> {
  let fileHandle: fs.WriteStream | null = null

  try {
    const baseDir = destinationFolder || path.join(process.cwd(), 'results')
    const dateStr = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-')
    const resultsDir = path.join(baseDir, `results-${dateStr}`)

    const fileName = `${prefix}.tar`
    const filePath = path.join(resultsDir, fileName)

    console.log('File path:', filePath)

    await fs.promises.mkdir(resultsDir, { recursive: true })

    fileHandle = fs.createWriteStream(filePath, { highWaterMark: 16 * 1024 * 1024 })

    for await (const chunk of stream) {
      console.log('-->Chunk size:', chunk.length)

      if (!fileHandle.write(chunk.subarray())) {
        await once(fileHandle, 'drain')
      }
    }

    fileHandle.end()
    await once(fileHandle, 'finish')

    const extractDir = path.join(resultsDir, `${prefix}_extracted`)
    await fs.promises.mkdir(extractDir, { recursive: true })

    try {
      await tar.x({
        file: filePath,
        cwd: extractDir,
        preservePaths: true
      })
      console.log(`Extracted contents to: ${extractDir}`)
      return filePath
    } catch (extractError) {
      console.error('Error extracting tar contents:', extractError)
      return filePath
    }
  } catch (error: any) {
    console.error('Error saving tar output:', error)
    throw new Error(`Failed to save tar output: ${error.message}`)
  } finally {
    if (fileHandle && !fileHandle.closed) {
      fileHandle.destroy()
    }
  }
}

export async function getComputeEnvironments(
  multiaddresses: string[] | undefined
) {
  const environments = await P2PCommand(
    PROTOCOL_COMMANDS.COMPUTE_GET_ENVIRONMENTS,
    multiaddresses,
    {}
  )
  if (!environments || environments.length === 0) {
    throw new Error('No compute environments available')
  }
  return environments
}

export async function generateAuthToken(
  multiaddresses: string[] | undefined,
  signer: Signer
) {
  const consumerAddress = await signer.getAddress()
  const nonce = await P2PCommand(PROTOCOL_COMMANDS.NONCE, multiaddresses, {
    address: consumerAddress
  })
  const incrementedNonce = (nonce + 1).toString()
  const signature = await getSignature(signer, consumerAddress + incrementedNonce)
  const response = await P2PCommand(
    PROTOCOL_COMMANDS.CREATE_AUTH_TOKEN,
    multiaddresses,
    {
      address: consumerAddress,
      signature,
      nonce: incrementedNonce
    }
  )
  return response.token
}

export async function withRetrial<T>(
  fn: () => Promise<T>,
  progress?: vscode.Progress<{ message?: string }>,
  maxRetries: number = 5,
  delay: number = 2000
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
        progress.report({
          message: `Attempt ${attempt + 1} failed. Retry in ${retryDelay}ms...`
        })
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
    }
  }

  throw lastError!
}
