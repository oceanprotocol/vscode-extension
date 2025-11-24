import { ethers, JsonRpcSigner, Signer, toUtf8Bytes } from "ethers";
import jwt from 'jsonwebtoken';

const signProviderRequest = async (signer: Signer, message: string) => {
    const consumerMessage = ethers.keccak256(toUtf8Bytes(message))
    const messageHashBytes = ethers.getBytes(consumerMessage)
    try {
        return await signer.signMessage(messageHashBytes)
    } catch (error) {
        const network = await signer.provider.getNetwork()
        const chainId = Number(network.chainId)
        if (chainId === 8996) {
            return await (signer as JsonRpcSigner)._legacySignMessage(messageHashBytes)
        }
    }
}

export const getSignature = async (
    signerOrAuthToken: Signer | string,
    message: string
): Promise<string | null> => {
    const isAuthToken = typeof signerOrAuthToken === 'string'
    return isAuthToken ? null : await signProviderRequest(signerOrAuthToken, message)
}

const decodeJwt = (token: string) => {
    try {
        const decoded = jwt.decode(token, { json: true })
        return decoded;
    } catch (error) {
        throw new Error('Error decoding JWT')
    }
}

export const getConsumerAddress = async (signerOrAuthToken: Signer | string): Promise<string> => {
    const isAuthToken = typeof signerOrAuthToken === 'string'
    return isAuthToken
        ? decodeJwt(signerOrAuthToken).address
        : await signerOrAuthToken.getAddress()
}

export const getAuthorization = (signerOrAuthToken: Signer | string): string | undefined => {
    const isAuthToken = typeof signerOrAuthToken === 'string'
    return isAuthToken ? signerOrAuthToken : undefined
}

