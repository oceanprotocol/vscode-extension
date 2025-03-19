import { ethers, Signer } from 'ethers'

export interface SignatureParams {
  signer: Signer
  consumerAddress: string
  jobId: string
  nonce?: number
  index?: number
}

export interface SignatureResult {
  signature: string
  walletAddress: string
  hashedMessage: string
  recoveredAddress: string
  isValid: boolean
}

export async function generateSignature(
  message: string,
  signer: Signer
): Promise<SignatureResult> {
  try {
    // Hash the message exactly as done in Ocean Protocol
    const messageHash = ethers.utils.solidityKeccak256(
      ['bytes'],
      [ethers.utils.hexlify(ethers.utils.toUtf8Bytes(message))]
    )

    // Convert to bytes and sign
    const messageHashBytes = ethers.utils.arrayify(messageHash)
    const signature = await signer.signMessage(messageHashBytes)

    // Get wallet address from signer
    const walletAddress = await signer.getAddress()

    // Verify signature
    const recoveredAddress = ethers.utils.verifyMessage(messageHashBytes, signature)

    const isValid = recoveredAddress.toLowerCase() === walletAddress.toLowerCase()

    return {
      signature,
      walletAddress,
      hashedMessage: messageHash,
      recoveredAddress,
      isValid
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate nonce signature: ${error.message}`)
    }
    throw error
  }
}
