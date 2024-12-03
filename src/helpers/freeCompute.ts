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
  ConsumeMarketFee,
  ComputeAsset
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

function getFreeStartComputePayload(
  nonce: number,
  signature: string,
  consumerAddress: string,
  dataset: any,
  algorithm: any
) {
  return {
    command: 'freeStartCompute',
    consumerAddress: consumerAddress,
    nonce: nonce,
    signature: signature,
    datasets: [dataset],
    algorithm: algorithm
  }
}

export async function computeStart(
  datasets: any,
  algorithm: any,
  computeEnv: string,
  signer: Signer,
  macOsProviderUrl?: string,
  providerUrl?: string
) {
  const { chainId } = await signer.provider.getNetwork()
  const providerURI =
    this.macOsProviderUrl && chainId === 8996 ? macOsProviderUrl : providerUrl

  const computeEnvs = await ProviderInstance.getComputeEnvironments(
    this.macOsProviderUrl || this.providerUrl
  )

  const computeEnvID = computeEnv
  const chainComputeEnvs = computeEnvs[chainId]
  let chainComputeEnv = chainComputeEnvs[0]

  if (computeEnvID && computeEnvID.length > 1) {
    for (const index in chainComputeEnvs) {
      if (computeEnvID == chainComputeEnvs[index].id) {
        chainComputeEnv = chainComputeEnvs[index]
        continue
      }
    }
  }

  console.log('Starting free compute job using provider: ', providerURI)

  const nonce =
    (await ProviderInstance.getNonce(providerURI, await signer.getAddress())) + 1
  let signatureMessage = await signer.getAddress()
  signatureMessage += nonce
  const signature = await ProviderInstance.signProviderRequest(signer, signatureMessage)
  try {
    const response = await fetch(providerURI + '/directCommand', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(
        getFreeStartComputePayload(
          nonce,
          signature,
          chainComputeEnv.consumerAddress,
          datasets,
          algorithm
        )
      )
    })
    console.log('Free Start Compute response: ' + JSON.stringify(response))
  } catch (e) {
    console.error('Free start compute error: ', e)
  }
}
