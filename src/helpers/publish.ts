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
  templateIndex: number = 1,
  macOsProviderUrl?: string,
  encryptDDO: boolean = true
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
    ZERO_ADDRESS,
    aquariusInstance
  )
}
