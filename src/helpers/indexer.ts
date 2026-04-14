import { ProviderInstance } from '@oceanprotocol/lib'

export const fetchDdoByDid = async (multiaddrs: string[] | undefined, did: string) => {
  const uri = multiaddrs?.[0]
  if (!uri) return null
  try {
    return await ProviderInstance.resolveDdo(uri, did)
  } catch (error) {
    console.error('Error fetching DDO:', error)
    return null
  }
}
