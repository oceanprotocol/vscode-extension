import { directNodeCommand } from "./direct-command"

export const fetchDdoByDid = async (peerId: string, did: string) => {
  try {
    const response = await directNodeCommand('findDDO', peerId, { did })
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching DDO:', error)
    return null
  }
}
