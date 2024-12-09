import { ProviderInstance } from '@oceanprotocol/lib'
import { Signer } from 'ethers'

export async function computeStart(
  dataset: any,
  algorithm: any,
  signer: Signer,
  nodeUrl: string
) {
  console.log('Starting free compute job using provider: ', nodeUrl)
  const consumerAddress: string = await signer.getAddress()

  const nonce = (await ProviderInstance.getNonce(nodeUrl, await signer.getAddress())) + 1
  console.log('Nonce: ', nonce)

  try {
    const response = await fetch(nodeUrl + '/directCommand', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        command: 'freeStartCompute',
        consumerAddress: consumerAddress,
        nonce: nonce,
        signature: '0x123',
        datasets: [dataset],
        algorithm: algorithm
      })
    })
    console.log('Free Start Compute response: ' + JSON.stringify(response))
  } catch (e) {
    console.error('Free start compute error: ', e)
  }
}
