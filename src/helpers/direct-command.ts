import { Signer } from "ethers";
import { getAuthorization } from "./auth";

export const NODE_URL = 'https://compute1.oceanprotocol.com:443'

const MAX_RETRIAL_NUMBER = 5;

export const directNodeCommand = async (command: string, peerId: string, body: any, signerOrAuthToken?: Signer | string | null, retrialNumber: number = 0): Promise<any> => {
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

        // this method requires streams, so we return the response directly
        if (command === 'getComputeStreamableLogs') {
            return response;
        }

        if (response.headers?.get('Content-Type')?.includes('application/octet-stream')) {
            const arrayBuffer = await response.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            return buffer
        }

        // If connection is not established, retry
        const copyRequestText = await response.clone().text();
        if (copyRequestText.includes('Cannot connect to peer') && retrialNumber < MAX_RETRIAL_NUMBER) {
            console.log('Could not resolve peer connection, retrying...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            return await directNodeCommand(command, peerId, body, signerOrAuthToken, retrialNumber + 1);
        }

        if (response.headers?.get('Content-Type')?.includes('text/plain')) {
            const responseText = await response.text();
            console.log('responseText:', responseText);
            return responseText;
        }

        const text = await response.text();
        try {
            const json = JSON.parse(text);
            return json;
        } catch (error) {
            return text;
        }
    } catch (error) {
        console.error('Gateway node failed:', error);
        throw new Error(`Gateway node error: ${error.message}`);
    }
}

