import { Aquarius, createAsset, ZERO_ADDRESS, Datatoken4 } from '@oceanprotocol/lib'
import { Signer } from 'ethers'

export async function createAssetUtil(
  name: string,
  symbol: string,
  owner: Signer,
  assetUrl: any,
  ddo: any,
  providerUrl: string,
  aquariusInstance: Aquarius,
  encryptDDO: boolean = true,
  templateIndex: number = 1,
  providerFeeToken?: string,
  macOsProviderUrl?: string
) {
  return await createAsset(
    name,
    symbol,
    owner,
    assetUrl,
    templateIndex,
    ddo,
    encryptDDO,
    macOsProviderUrl || providerUrl,
    providerFeeToken || ZERO_ADDRESS,
    aquariusInstance
  )
}
