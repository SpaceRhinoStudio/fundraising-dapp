import { owner2, owner1, owner3, owner4 } from "../constants";
import { getSavedContractAddresses } from "../fileUtils";
import { deployMultisig } from "./multisigDeployer";
import { canCoreMultisigBeDeployed, isNetworkDeployable } from "./_common";
import hre from "hardhat"

export async function deploy() {
    let contracts = getSavedContractAddresses()
    let networkName = hre.network.name

    if (isNetworkDeployable(networkName) === false) return

    if (await canCoreMultisigBeDeployed(contracts, networkName) === false) return

    // multisig
    let multisig = await deployMultisig([owner2, owner3, owner1, owner4])
}

deploy().catch(error => {
    console.error(error);
    process.exitCode = 1;
})