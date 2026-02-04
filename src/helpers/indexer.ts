import { PROTOCOL_COMMANDS } from '../enum'
import { P2PCommand } from './p2p'

export const fetchDdoByDid = async (
  multiaddrs: string[] | undefined,
  did: string
) => {
  try {
    const response = await P2PCommand(PROTOCOL_COMMANDS.FIND_DDO, multiaddrs, {
      did
    })
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching DDO:', error)
    return null
  }
}
