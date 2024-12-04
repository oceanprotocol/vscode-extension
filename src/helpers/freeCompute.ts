import { ProviderInstance } from '@oceanprotocol/lib'
import { Signer } from 'ethers'

export async function computeStart(
  dataset: any,
  algorithm: any,
  computeEnv: string,
  signer: Signer,
  macOsProviderUrl?: string,
  providerUrl?: string
) {
  const { chainId } = await signer.provider.getNetwork()
  const providerURI =
    this.macOsProviderUrl && chainId === 8996 ? macOsProviderUrl : providerUrl

  const computeEnvs = await ProviderInstance.getComputeEnvironments(
    this.macOsProviderUrl || this.providerUrl
  )

  const computeEnvID = computeEnv
  const chainComputeEnvs = computeEnvs[chainId]
  let chainComputeEnv = chainComputeEnvs[0]

  if (computeEnvID && computeEnvID.length > 1) {
    for (const index in chainComputeEnvs) {
      if (computeEnvID == chainComputeEnvs[index].id) {
        chainComputeEnv = chainComputeEnvs[index]
        continue
      }
    }
  }

  console.log('Starting free compute job using provider: ', providerURI)

  const nonce =
    (await ProviderInstance.getNonce(providerURI, await signer.getAddress())) + 1
  let signatureMessage = await signer.getAddress()
  signatureMessage += nonce
  const signature = await ProviderInstance.signProviderRequest(signer, signatureMessage)
  try {
    const response = await fetch(providerURI + '/directCommand', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        command: 'freeStartCompute',
        consumerAddress: chainComputeEnv.consumerAddress,
        nonce: nonce,
        signature: signature,
        datasets: [dataset],
        algorithm: algorithm
      })
    })
    console.log('Free Start Compute response: ' + JSON.stringify(response))
  } catch (e) {
    console.error('Free start compute error: ', e)
  }
}
