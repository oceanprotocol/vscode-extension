export const fetchDdoByDid = async (nodeUrl: string, did: string) => {
  try {
    const response = await fetch(`${nodeUrl}/api/aquarius/assets/metadata/${did}`)
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching DDO:', error)
    return null
  }
}
