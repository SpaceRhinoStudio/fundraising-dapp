import { getSavedContractAddresses } from "../fileUtils";
import { isGnosisSafeDeployed, isNetworkDeployable, isNetworkRegistered, isSeedSaleDeployed } from "./_common";
import { deploySeedSale } from "./seedSaleDeployer";
import { deployTeamVault } from "./teamVaultDeployer";
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
    contracts = getSavedContractAddresses()

    if (await isSeedSaleDeployed(contracts, networkName) === false) return

    let teamVault = await deployTeamVault(OWNER_ADDRSS, OWNER_SHARES)
    contracts = getSavedContractAddresses()

    console.log("SeedSale has been deployed at: " + seedSale.address)
    console.log("TeamVault has been deployed at: " + teamVault.address)
}

deployStage1().catch(error => {
    console.error(error);
    process.exitCode = 1;
})