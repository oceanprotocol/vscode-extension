import {
  Aquarius,
  DatatokenCreateParams,
  Nft,
  NftCreateData,
  NftFactory,
  ProviderInstance,
  ZERO_ADDRESS,
  ConfigHelper,
  getEventFromTx,
  DispenserCreationParams,
  FreCreationParams
} from '@oceanprotocol/lib'
import { ethers, Signer } from 'ethers'
import { SHA256 } from 'crypto-js'
import { hexlify } from 'ethers/lib/utils'
import { createHash } from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'

export async function createAsset(
  name: string,
  symbol: string,
  owner: Signer,
  assetUrl: any,
  ddo: any,
  providerUrl: string,
  aquariusInstance: Aquarius,
  macOsProviderUrl?: string,
  encryptDDO: boolean = true
) {
  // Expand the ${HOME} variable in the ADDRESS_FILE path
  const addressFilePath = process.env.ADDRESS_FILE
    ? process.env.ADDRESS_FILE.replace('${HOME}', os.homedir())
    : path.join(os.homedir(), '.ocean', 'ocean-contracts', 'artifacts', 'address.json')

  console.log('Address file path:', addressFilePath)

  // Check if the address file exists
  if (!fs.existsSync(addressFilePath)) {
    throw new Error(`Address file not found: ${addressFilePath}`)
  }

  // Read the address file
  const addressFileContent = fs.readFileSync(addressFilePath, 'utf8')
  const addresses = JSON.parse(addressFileContent)
  console.log('Addresses:', addresses)

  const { chainId } = await owner.provider.getNetwork()
  console.log('Chain ID:', chainId)
  const nft = new Nft(owner, chainId)
  const config = new ConfigHelper().getConfig(chainId)
  console.log('Config:', config)

  // Use the addresses from the file if available
  const networkAddresses = addresses[config.network]
  console.log('Network addresses:', networkAddresses)
  if (networkAddresses) {
    config.nftFactoryAddress = networkAddresses.ERC721Factory || config.nftFactoryAddress
    config.oceanTokenAddress = networkAddresses.Ocean || config.oceanTokenAddress
    config.dispenserAddress = networkAddresses.Dispenser || config.dispenserAddress
    config.fixedRateExchangeAddress =
      networkAddresses.FixedPrice || config.fixedRateExchangeAddress
  }

  if (!config.nftFactoryAddress) {
    throw new Error(`NFT Factory address not found for network: ${config.network}`)
  }

  const nftFactory = new NftFactory(config.nftFactoryAddress, owner)

  ddo.chainId = parseInt(chainId.toString(10))
  console.log('DDO chain ID:', ddo.chainId)
  const nftParamsAsset: NftCreateData = {
    name,
    symbol,
    templateIndex: 1,
    tokenURI: 'aaa',
    transferable: true,
    owner: await owner.getAddress()
  }
  console.log('NFT params:', nftParamsAsset)
  const datatokenParams: DatatokenCreateParams = {
    templateIndex: 1,
    cap: '100000',
    feeAmount: '0',
    paymentCollector: await owner.getAddress(),
    feeToken: config.oceanTokenAddress,
    minter: await owner.getAddress(),
    mpFeeAddress: ZERO_ADDRESS
  }
  console.log('Datatoken params:', datatokenParams)

  let bundleNFT
  if (!ddo.stats.price.value) {
    console.log('Creating NFT with datatoken')
    bundleNFT = await nftFactory.createNftWithDatatoken(nftParamsAsset, datatokenParams)
  } else if (ddo.stats.price.value === '0') {
    console.log('Creating NFT with datatoken and dispenser')
    const dispenserParams: DispenserCreationParams = {
      dispenserAddress: config.dispenserAddress,
      maxTokens: '1',
      maxBalance: '100000000',
      withMint: true,
      allowedSwapper: ZERO_ADDRESS
    }

    bundleNFT = await nftFactory.createNftWithDatatokenWithDispenser(
      nftParamsAsset,
      datatokenParams,
      dispenserParams
    )
  } else {
    console.log('Creating NFT with datatoken and fixed rate')
    console.log('fixed rate address: ', config.fixedRateExchangeAddress)
    console.log('ocean token address: ', config.oceanTokenAddress)
    console.log('owner: ', await owner.getAddress())
    console.log('fixed rate:', ddo.stats.price.value)

    const fixedPriceParams: FreCreationParams = {
      fixedRateAddress: config.fixedRateExchangeAddress,
      baseTokenAddress: config.oceanTokenAddress,
      owner: await owner.getAddress(),
      marketFeeCollector: await owner.getAddress(),
      baseTokenDecimals: 18,
      datatokenDecimals: 18,
      fixedRate: ddo.stats.price.value.toString(),
      marketFee: '0',
      allowedConsumer: await owner.getAddress(),
      withMint: true
    }
    console.log('nft params:', nftParamsAsset)
    console.log('datatoken params:', datatokenParams)
    console.log('Fixed rate params:', fixedPriceParams)

    try {
      bundleNFT = await nftFactory.createNftWithDatatokenWithFixedRate(
        nftParamsAsset,
        datatokenParams,
        fixedPriceParams
      )
    } catch (error) {
      console.error('Error creating NFT with fixed rate!')
      console.error('Error creating NFT with fixed rate:', error)
      throw error
    }
  }
  console.log('Bundle NFT:', bundleNFT)

  const trxReceipt = await bundleNFT.wait()
  console.log('Transaction receipt:', trxReceipt)
  // events have been emitted
  const nftCreatedEvent = getEventFromTx(trxReceipt, 'NFTCreated')
  const tokenCreatedEvent = getEventFromTx(trxReceipt, 'TokenCreated')

  const nftAddress = nftCreatedEvent.args.newTokenAddress
  console.log('NFT address:', nftAddress)
  const datatokenAddressAsset = tokenCreatedEvent.args.newTokenAddress
  // create the files encrypted string
  assetUrl.datatokenAddress = datatokenAddressAsset
  assetUrl.nftAddress = nftAddress
  ddo.services[0].files = await ProviderInstance.encrypt(
    assetUrl,
    chainId,
    macOsProviderUrl || providerUrl
  )
  ddo.services[0].datatokenAddress = datatokenAddressAsset
  ddo.services[0].serviceEndpoint = providerUrl

  ddo.nftAddress = nftAddress
  ddo.id = 'did:op:' + SHA256(ethers.utils.getAddress(nftAddress) + chainId.toString(10))

  let metadata
  let metadataHash
  let flags
  if (encryptDDO) {
    metadata = await ProviderInstance.encrypt(
      ddo,
      chainId,
      macOsProviderUrl || providerUrl
    )
    const validateResult = await aquariusInstance.validate(ddo)
    metadataHash = validateResult.hash
    flags = 2
  } else {
    const stringDDO = JSON.stringify(ddo)
    const bytes = Buffer.from(stringDDO)
    metadata = hexlify(bytes)
    metadataHash = '0x' + createHash('sha256').update(metadata).digest('hex')
    flags = 0
  }

  await nft.setMetadata(
    nftAddress,
    await owner.getAddress(),
    0,
    providerUrl,
    '',
    ethers.utils.hexlify(flags),
    metadata,
    metadataHash
  )
  return ddo.id
}
