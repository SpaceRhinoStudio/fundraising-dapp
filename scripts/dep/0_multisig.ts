import { OWNER_ADDRSS } from "../constants";
import { getSavedContractAddresses } from "../fileUtils";
import { deployMultisig } from "./multisigDeployer";
import { canCoreMultisigBeDeployed, isNetworkDeployable } from "./_common";
import hre, { ethers } from "hardhat"

export async function deploy() {
    let contracts = getSavedContractAddresses()
    let networkName = hre.network.name

    if (isNetworkDeployable(networkName) === false) return

    if (await canCoreMultisigBeDeployed(contracts, networkName) === false) return

    // multisig
    let signer = (await ethers.getSigners())[0]
    let deployerAddress = await signer.getAddress()
    let multisig = await deployMultisig([deployerAddress])

    try {
        console.log("waiting for verification...")
        await hre.run("verify:verify", {
            address: multisig.address,
            constructorArguments: [
                [deployerAddress]
            ],
        });
        console.log("verification is done!")
    } catch (error) {
        console.log("*************verification failed!*************")
        console.log(error)
    }
}

deploy().catch(error => {
    console.error(error);
    process.exitCode = 1;
})