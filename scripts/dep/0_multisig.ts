import { OWNER_ADDRS } from "../constants";
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
    let multisig = await deployMultisig(OWNER_ADDRS)
}

deploy().catch(error => {
    console.error(error);
    process.exitCode = 1;
})