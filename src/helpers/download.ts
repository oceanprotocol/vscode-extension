import {
    Aquarius,
    Datatoken,
    ProviderInstance,
    ConfigHelper,
    orderAsset
} from '@oceanprotocol/lib'
import { Signer } from 'ethers'
import fs from 'fs'
import * as path from "path"


  export async function downloadFile(
	url: string,
	downloadPath: string,
	index?: number
): Promise<any> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("Response error.");
	}

	const defaultName = !isNaN(index) && index > -1 ? `file_${index}.out` : 'file.out'
	let filename: string

	try {
		// try to get it from headers
		filename = response.headers
			.get("content-disposition")
			.match(/attachment;filename=(.+)/)[1];
	} catch {
		filename = defaultName;
	}

	const filePath = path.join(downloadPath, filename);
	const data = await response.arrayBuffer();

	try {
		await fs.writeFile(filePath, Buffer.from(data));
	} catch (err) {
		throw new Error("Error while saving the file:", err.message);
	}

	return filename
}


export async function download(
  did: string,
  owner: Signer,
  pathString: string = '.',
  aquariusInstance: Aquarius,
  macOsProviderUrl?: string,
  providerUrl?: string,
) {
    const dataDdo = await aquariusInstance.waitForAqua(did);
    if (!dataDdo) {
        console.error(
            "Error fetching DDO " + did + ".  Does this asset exists?"
        )
        return
    }
    let providerURI
    if (!providerUrl) {
        providerURI = macOsProviderUrl && dataDdo.chainId === 8996
        ? macOsProviderUrl
        : dataDdo.services[0].serviceEndpoint
    } else {
        providerURI = providerUrl
    }
    console.log("Downloading asset using provider: ", providerURI)
    const { chainId } = await owner.provider.getNetwork()
    console.log('Chain ID:', chainId)
    const config = new ConfigHelper().getConfig(chainId)
    console.log('Config:', config)
    const datatoken = new Datatoken(owner, chainId)

    const tx = await orderAsset(
        dataDdo,
        owner,
        config,
        datatoken,
        providerURI
    )

    if (!tx) {
        console.error(
            "Error ordering access for " + did + ".  Do you have enough tokens?"
        )
        return
    }

    const orderTx = await tx.wait();

    const urlDownloadUrl = await ProviderInstance.getDownloadUrl(
        dataDdo.id,
        dataDdo.services[0].id,
        0,
        orderTx.transactionHash,
        providerURI,
        owner
    );
    try {
        const path = pathString ? pathString : '.';
        const { filename } = await downloadFile(urlDownloadUrl, path);
        console.log("File downloaded successfully:", path + "/" + filename);
    } catch (e) {
        console.log(`Download url dataset failed: ${e}`);
    }
}