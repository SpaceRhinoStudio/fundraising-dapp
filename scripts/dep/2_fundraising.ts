import { getSavedContractAddresses } from "../fileUtils";
import { deployFundraising } from "./fundraisingDeployer";
import { isGnosisSafeDeployed, isNetworkDeployable, isNetworkRegistered, isSeedSaleDeployed, isStakeHoldersDeployed } from "./_common";
import { COLLATERALS } from "../constants";
import hre from "hardhat"

export async function deploy() {
    let contracts = getSavedContractAddresses()
    let networkName = hre.network.name
    let networkContracts = contracts[networkName]
    let collateral = COLLATERALS[hre.network.name as keyof typeof COLLATERALS]

    if (isNetworkDeployable(networkName) === false) return
    if (isNetworkRegistered(contracts, networkName) === false) return
    if (await isGnosisSafeDeployed(contracts, networkName) === false) return
    if (await isSeedSaleDeployed(contracts, networkName) === false) return
    if (await isStakeHoldersDeployed(contracts, networkName) === false) return

    let gnosisSafe: string = networkContracts['GnosisSafe'].address
    let seedSale: string = networkContracts['SeedSale'].address
    let stakeHolder: string = networkContracts['StakeHolders'].address

    let { controller, preSale } = await deployFundraising(gnosisSafe, stakeHolder, seedSale, collateral)

    console.log("Controller has been deployed at: " + controller.address)
    console.log("PreSale has been deployed at: " + preSale.address)
}

deploy().catch(error => {
    console.error(error);
    process.exitCode = 1;
})