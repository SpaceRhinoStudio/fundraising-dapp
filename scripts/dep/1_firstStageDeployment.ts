import { getSavedContractAddresses } from "../fileUtils";
import { isGnosisSafeDeployed, isNetworkDeployable, isNetworkRegistered, isSeedSaleDeployed } from "./_common";
import { deploySeedSale } from "./seedSaleDeployer";
import { deployStakeHolders } from "./stakeHoldersDeployer";
import { OWNER_ADDRSS, OWNER_SHARES } from "../constants";
import hre from "hardhat"

export async function deployStage1() {
    let contracts = getSavedContractAddresses()
    let networkName = hre.network.name
    let networkContracts = contracts[networkName]

    if (isNetworkDeployable(networkName) === false) return

    if (isNetworkRegistered(contracts, networkName) === false) return
    if (await isGnosisSafeDeployed(contracts, networkName) === false) return

    let gnosisSafe = networkContracts['GnosisSafe'].address

    console.log("GnosisAddress is:  " + gnosisSafe)

    let seedSale = await deploySeedSale(gnosisSafe)

    if (await isSeedSaleDeployed(contracts, networkName) === false) return

    let stakeHolder = await deployStakeHolders(OWNER_ADDRSS, OWNER_SHARES)

    console.log("SeedSale has been deployed at: " + seedSale.address)
    console.log("StakeHolder has been deployed at: " + stakeHolder.address)
}

deployStage1().catch(error => {
    console.error(error);
    process.exitCode = 1;
})