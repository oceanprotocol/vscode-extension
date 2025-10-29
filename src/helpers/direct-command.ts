import { Signer } from "ethers";
import { getAuthorization } from "./auth";

export const NODE_URL = 'https://compute1.oceanprotocol.com:443'

export const directNodeCommand = async (command: string, peerId: string, body: any, signerOrAuthToken?: Signer | string | null): Promise<Response> => {
    try {
        const authorization = getAuthorization(signerOrAuthToken)
        const response = await fetch(`${NODE_URL}/directCommand`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authorization
            },
            body: JSON.stringify({
                command,
                node: peerId,
                authorization,
                ...body
            }),
        });

        if (!response.ok && response.status >= 500) {
            throw new Error(`Gateway node error: ${response.status}`);
        }

        return response;
    } catch (error) {
        console.error('Gateway node failed, falling back to direct fetch:', error);
        throw new Error(`Gateway node error: ${error}`);
    }
}
