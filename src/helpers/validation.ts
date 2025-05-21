export const validateDatasetFromInput = async (input: string): Promise<boolean> => {
  if (input.startsWith('http')) {
    const response = await fetch(input)
    return response.status === 200
  }

  if (input.startsWith('Qm')) {
    const response = await fetch(`https://ipfs.io/ipfs/${input}`)
    return response.status === 200
  }

  if (input.startsWith('did:')) {
    return true
  }

  const unknownInputArweave = await fetch(`https://arweave.net/${input}`)
  if (unknownInputArweave.status === 200) {
    return true
  }

  const unknownInputIpfs = await fetch(`https://ipfs.io/ipfs/${input}`)
  if (unknownInputIpfs.status === 200) {
    return true
  }

  return false
}
