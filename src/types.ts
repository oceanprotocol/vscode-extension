import { ComputeResourceRequest } from "@oceanprotocol/lib"

export class SelectedConfig {
    authToken: string
    nodeUrl: string
    isFreeCompute: string
    environmentId: string
    feeToken: string
    jobDuration: string
    resources: ComputeResourceRequest

    constructor(authToken: string, nodeUrl: string, isFreeCompute: string, environmentId: string, feeToken: string, jobDuration: string, resources: string) {
        this.authToken = authToken
        this.nodeUrl = nodeUrl
        this.isFreeCompute = isFreeCompute
        this.environmentId = environmentId
        this.feeToken = feeToken
        this.jobDuration = jobDuration
        this.resources = this.parseResources(resources)
    }

    private parseResources(resources: string): ComputeResourceRequest {
        const resourcesRequestJson = JSON.parse(resources)
        return resourcesRequestJson.map((resource: any) => ({ id: resource.id, amount: resource.amount }))
    }

    updateFields(params: Partial<SelectedConfig>): void {
        Object.assign(this, params)
    }

}