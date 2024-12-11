import { ethers } from 'ethers'

export interface SignatureParams {
  privateKey: string
  consumerAddress: string
  jobId: string
  index?: number
  nonce?: string
}

export interface SignatureResult {
  signature: string
  walletAddress: string
  hashedMessage: string
  recoveredAddress: string
  isValid: boolean
}

export async function generateOceanSignature({
  privateKey,
  consumerAddress,
  jobId,
  index = 0,
  nonce = '1'
}: SignatureParams): Promise<SignatureResult> {
  try {
    // Create wallet instance from private key
    const wallet = new ethers.Wallet(privateKey)

    // Create message string
    const message = consumerAddress + jobId + index.toString() + nonce

    // Hash the message exactly as done in Ocean Protocol
    const consumerMessage = ethers.utils.solidityKeccak256(
      ['bytes'],
      [ethers.utils.toUtf8Bytes(message)]
    )

    // Convert the hash to bytes
    const messageHashBytes = ethers.utils.arrayify(consumerMessage)

    // Sign the hashed message
    const signature = await wallet.signMessage(messageHashBytes)

    // Verify the signature
    const recoveredAddress = ethers.utils.verifyMessage(messageHashBytes, signature)
    const isValid = recoveredAddress.toLowerCase() === consumerAddress.toLowerCase()

    return {
      signature,
      walletAddress: wallet.address,
      hashedMessage: consumerMessage,
      recoveredAddress,
      isValid
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate signature: ${error.message}`)
    }
    throw error
  }
}
