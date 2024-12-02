import {
  Aquarius,
  DatatokenCreateParams,
  Nft,
  NftCreateData,
  NftFactory,
  ProviderInstance,
  ComputeAlgorithm,
  Datatoken,
  Asset,
  DDO,
  ComputeOutput,
  ProviderComputeInitialize,
  ZERO_ADDRESS,
  ConfigHelper,
  getEventFromTx,
  DispenserCreationParams,
  FreCreationParams,
  approveWei,
  orderAsset,
  Config,
  ProviderFees,
  ConsumeMarketFee
} from '@oceanprotocol/lib'
import { ethers, Signer } from 'ethers'
import { SHA256 } from 'crypto-js'
import { hexlify } from 'ethers/lib/utils'
import { createHash } from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { isPrivateIP, getPublicIP } from './ip'

export async function getMetadataURI() {
  const metadataURI = process.env.AQUARIUS_URL
  const parsed = new URL(metadataURI)
  let ip = metadataURI // by default
  // has port number?
  const hasPort = parsed.port && !isNaN(Number(parsed.port))
  if (hasPort) {
    // remove the port, just get the host part
    ip = parsed.hostname
  }
  // check if is private or loopback
  if (isPrivateIP(ip)) {
    // get public V4 ip address
    ip = await getPublicIP()
    if (!ip) {
      return metadataURI
    }
  }
  // if we removed the port add it back
  if (hasPort) {
    ip = `http://${ip}:${parsed.port}`
  }
  return ip
}

export async function handleComputeOrder(
  order: ProviderComputeInitialize,
  asset: Asset,
  payerAccount: Signer,
  consumerAddress: string,
  serviceIndex: number,
  datatoken: Datatoken,
  config: Config,
  providerFees: ProviderFees,
  providerUrl: string,
  consumeMarkerFee?: ConsumeMarketFee
) {
  /* We do have 3 possible situations:
       - have validOrder and no providerFees -> then order is valid, providerFees are valid, just use it in startCompute
       - have validOrder and providerFees -> then order is valid but providerFees are not valid, we need to call reuseOrder and pay only providerFees
       - no validOrder -> we need to call startOrder, to pay 1 DT & providerFees
    */
  const hasProviderFees = order.providerFee && order.providerFee.providerFeeAmount
  // no need to approve if it is 0
  if (hasProviderFees && Number(order.providerFee.providerFeeAmount) > 0) {
    await approveWei(
      payerAccount,
      config,
      await payerAccount.getAddress(),
      order.providerFee.providerFeeToken,
      asset.services[0].datatokenAddress,
      order.providerFee.providerFeeAmount
    )
  }
  if (order.validOrder) {
    if (!order.providerFee) {
      return order.validOrder
    }
    const tx = await datatoken.reuseOrder(
      asset.services[0].datatokenAddress,
      order.validOrder,
      order.providerFee
    )
    const reusedTx = await tx.wait()
    const orderReusedTx = getEventFromTx(reusedTx, 'OrderReused')
    return orderReusedTx.transactionHash
  }
  console.log('Ordering asset with DID: ', asset.id)
  const txStartOrder = await orderAsset(
    asset,
    payerAccount,
    config,
    datatoken,
    providerUrl,
    consumerAddress,
    consumeMarkerFee,
    providerFees
  )

  if (!txStartOrder) {
    return
  }
  const tx = await txStartOrder.wait()
  const orderStartedTx = getEventFromTx(tx, 'OrderStarted')

  return orderStartedTx.transactionHash
}

export async function isOrderable(
  asset: Asset | DDO,
  serviceId: string,
  algorithm: ComputeAlgorithm,
  algorithmDDO: Asset | DDO
): Promise<boolean> {
  const datasetService = asset.services.find((s) => s.id === serviceId)
  if (!datasetService) {
    return false
  }

  if (datasetService.type === 'compute') {
    if (algorithm.meta) {
      if (datasetService.compute.allowRawAlgorithm) {
        return true
      }
      return false
    }
    if (algorithm.documentId) {
      const algoService = algorithmDDO.services.find((s) => s.id === algorithm.serviceId)
      if (algoService && algoService.type === 'compute') {
        if (algoService.serviceEndpoint !== datasetService.serviceEndpoint) {
          console.error(
            'ERROR: Both assets with compute service are not served by the same provider'
          )
          return false
        }
      }
    }
  }
  return true
}

function getFreeStartComputePayload(
  nonce: number,
  signature: string,
  dataset: any,
  algorithm: any
) {
  return {
    command: 'freeStartCompute',
    consumerAddress: '0xC7EC1970B09224B317c52d92f37F5e1E4fF6B687',
    nonce: nonce,
    signature: signature,
    datasets: [dataset],
    algorithm: algorithm
  }
}

export async function computeStart(
  datasets: string,
  algorithm: string,
  freeStartComputeEnv: string,
  signer: Signer,
  pathString: string = '.',
  aquariusInstance: Aquarius,
  macOsProviderUrl?: string,
  providerUrl?: string
) {
  const inputDatasetsString = datasets
  let inputDatasets = []

  if (inputDatasetsString.includes('[') || inputDatasetsString.includes(']')) {
    const processedInput = inputDatasetsString.replaceAll(']', '').replaceAll('[', '')
    inputDatasets = processedInput.split(',')
  } else {
    inputDatasets.push(inputDatasetsString)
  }

  const ddos = []

  for (const dataset in inputDatasets) {
    const dataDdo = await this.aquarius.waitForAqua(inputDatasets[dataset])
    if (!dataDdo) {
      console.error('Error fetching DDO ' + dataset[1] + '.  Does this asset exists?')
      return
    } else {
      ddos.push(dataDdo)
    }
  }
  if (ddos.length <= 0 || ddos.length !== inputDatasets.length) {
    console.error('Not all the data ddos are available.')
    return
  }
  const providerURI =
    this.macOsProviderUrl && ddos[0].chainId === 8996
      ? this.macOsProviderUrl
      : ddos[0].services[0].serviceEndpoint

  const algoDdo = await aquariusInstance.waitForAqua(algorithm)
  if (!algoDdo) {
    console.error('Error fetching DDO ' + algorithm + '.  Does this asset exists?')
    return
  }

  const computeEnvs = await ProviderInstance.getComputeEnvironments(
    this.macOsProviderUrl || this.providerUrl
  )

  const datatoken = new Datatoken(
    this.signer,
    (await this.signer.provider.getNetwork()).chainId
  )

  const mytime = new Date()
  const computeMinutes = 5
  mytime.setMinutes(mytime.getMinutes() + computeMinutes)
  const computeValidUntil = Math.floor(mytime.getTime() / 1000)

  const computeEnvID = freeStartComputeEnv
  const chainComputeEnvs = computeEnvs[algoDdo.chainId]
  let computeEnv = chainComputeEnvs[0]

  if (computeEnvID && computeEnvID.length > 1) {
    for (const index in chainComputeEnvs) {
      if (computeEnvID == chainComputeEnvs[index].id) {
        computeEnv = chainComputeEnvs[index]
        continue
      }
    }
  }

  const algo: ComputeAlgorithm = {
    documentId: algoDdo.id,
    serviceId: algoDdo.services[0].id,
    meta: algoDdo.metadata.algorithm
  }

  const assets = []
  for (const dataDdo in ddos) {
    const canStartCompute = isOrderable(
      ddos[dataDdo],
      ddos[dataDdo].services[0].id,
      algo,
      algoDdo
    )
    if (!canStartCompute) {
      console.error(
        'Error Cannot start compute job using the datasets DIDs & algorithm DID provided'
      )
      return
    }
    assets.push({
      documentId: ddos[dataDdo].id,
      serviceId: ddos[dataDdo].services[0].id
    })
  }

  console.log('Starting free compute job using provider: ', providerURI)
  const providerInitializeComputeJob = await ProviderInstance.initializeCompute(
    assets,
    algo,
    computeEnv.id,
    computeValidUntil,
    providerURI,
    this.signer // V1 was this.signer.getAddress()
  )
  if (
    !providerInitializeComputeJob ||
    'error' in providerInitializeComputeJob.algorithm
  ) {
    console.error(
      'Error initializing Provider for the compute job using dataset DID ' +
        datasets +
        ' and algorithm DID ' +
        algorithm
    )
    return
  }

  console.log('Ordering algorithm: ', algorithm)
  algo.transferTxId = await handleComputeOrder(
    providerInitializeComputeJob.algorithm,
    algoDdo,
    this.signer,
    computeEnv.consumerAddress,
    0,
    datatoken,
    this.config,
    providerInitializeComputeJob?.algorithm?.providerFee,
    providerURI
  )
  if (!algo.transferTxId) {
    console.error(
      'Error ordering compute for algorithm with DID: ' +
        algorithm +
        '.  Do you have enough tokens?'
    )
    return
  }

  for (let i = 0; i < ddos.length; i++) {
    assets[i].transferTxId = await handleComputeOrder(
      providerInitializeComputeJob.datasets[i],
      ddos[i],
      this.signer,
      computeEnv.consumerAddress,
      0,
      datatoken,
      this.config,
      providerInitializeComputeJob?.datasets[i].providerFee,
      providerURI
    )
    if (!assets[i].transferTxId) {
      console.error(
        'Error ordering dataset with DID: ' + assets[i] + '.  Do you have enough tokens?'
      )
      return
    }
  }

  const additionalDatasets = assets.length > 1 ? assets.slice(1) : null
  console.log(
    'Starting compute job on ' +
      assets[0].documentId +
      ' with additional datasets:' +
      (!additionalDatasets ? 'none' : additionalDatasets[0].documentId)
  )
  if (additionalDatasets !== null) {
    console.log('Adding additional datasets to dataset, according to C2D V2 specs')
    assets.push(additionalDatasets)
  }

  const output: ComputeOutput = {
    metadataUri: await getMetadataURI()
  }
  if (aquariusInstance.aquariusURL === providerURI) {
    // for ocean nodes
    const nonce =
      (await ProviderInstance.getNonce(providerURI, await signer.getAddress())) + 1
    let signatureMessage = await signer.getAddress()
    signatureMessage += assets[0].documentId
    signatureMessage += nonce
    const signature = await ProviderInstance.signProviderRequest(signer, signatureMessage)
    fetch(providerURI + '/directCommand', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(getFreeStartComputePayload(nonce, signature, assets[0], algo))
    })
  }
  const computeJobs = await ProviderInstance.computeStart(
    providerURI,
    signer,
    computeEnv.id,
    assets[0], // assets[0] // only c2d v1,
    algo,
    null,
    // additionalDatasets, only c2d v1
    output,
    computeEnv.free ? true : false //
  )

  if (computeJobs && computeJobs[0]) {
    const { jobId, agreementId } = computeJobs[0]
    console.log('Compute started.  JobID: ' + jobId)
    console.log('Agreement ID: ' + agreementId)
  } else {
    console.log('Error while starting the compute job: ', computeJobs)
  }
}
