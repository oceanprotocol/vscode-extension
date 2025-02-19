import { ethers, Signer } from 'ethers'

export interface SignatureParams {
  signer: Signer
  consumerAddress: string
  jobId: string
  index?: number
  nonce?: number
}

export interface SignatureResult {
  signature: string
  walletAddress: string
  hashedMessage: string
  recoveredAddress: string
  isValid: boolean
}

export async function generateOceanSignature({
  signer,
  consumerAddress,
  jobId,
  index = 0,
  nonce = 1
}: SignatureParams): Promise<SignatureResult> {
  try {
    // Create message string
    const message = consumerAddress + jobId + index.toString() + nonce

    // Hash the message exactly as done in Ocean Protocol
    const consumerMessage = ethers.utils.solidityKeccak256(
      ['bytes'],
      [ethers.utils.hexlify(ethers.utils.toUtf8Bytes(message))]
    )

    // Convert to bytes and sign
    const messageHashBytes = ethers.utils.arrayify(consumerMessage)
    const signature = await signer.signMessage(messageHashBytes)

    // Get wallet address from signer
    const walletAddress = await signer.getAddress()

    // Verify using both methods like Ocean Protocol does
    const addressFromHashSignature = ethers.utils.verifyMessage(
      consumerMessage,
      signature
    )
    const addressFromBytesSignature = ethers.utils.verifyMessage(
      messageHashBytes,
      signature
    )

    const isValid =
      addressFromHashSignature.toLowerCase() === consumerAddress.toLowerCase() ||
      addressFromBytesSignature.toLowerCase() === consumerAddress.toLowerCase()

    return {
      signature,
      walletAddress,
      hashedMessage: consumerMessage,
      recoveredAddress: addressFromHashSignature,
      isValid
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate signature: ${error.message}`)
    }
    throw error
  }
}
