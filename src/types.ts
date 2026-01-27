import { ComputeResourceRequest } from '@oceanprotocol/lib'

export class SelectedConfig {
  authToken?: string
  address?: string
  peerId?: string
  isFreeCompute?: boolean
  environmentId?: string
  feeToken?: string
  jobDuration?: string
  resources?: ComputeResourceRequest[]
  chainId?: number

  constructor(params: Partial<SelectedConfig>) {
    Object.assign(this, params)
  }

  static parseResources(resources: string): ComputeResourceRequest[] {
    const resourcesRequestJson = JSON.parse(resources)
    return resourcesRequestJson.map((resource: any) => ({
      id: resource.id,
      amount: resource.amount
    }))
  }

  updateFields(params: Partial<SelectedConfig>): void {
    Object.assign(this, params)
  }
}

export type GatewayResponse = { httpStatus?: number; error?: string }
