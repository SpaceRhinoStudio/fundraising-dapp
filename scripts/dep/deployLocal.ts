import { BaseContract } from "ethers"
import hre from "hardhat"

import { saveContractAbi, saveContractAddress } from "../fileUtils"
import { FormatTypes } from "ethers/lib/utils"
import * as d from "./sharedLocalDeploy"

async function deployLocal() {
    let networkName = hre.network.name
    await d.deployContractsForTest()

    await saveContractInFile(networkName, 'CoreMultisig', d.multisig)
    await saveContractInFile(networkName, 'SeedSale', d.seedSale)
    await saveContractInFile(networkName, 'TeamVault', d.teamVault)
    await saveContractInFile(networkName, 'Controller', d.controller)
    await saveContractInFile(networkName, 'EngaToken', d.engaToken)
    await saveContractInFile(networkName, 'TokenManager', d.tokenManager)
    await saveContractInFile(networkName, 'MarketMaker', d.marketMaker)
    await saveContractInFile(networkName, 'BancorFormula', d.bancor)
    await saveContractInFile(networkName, 'Tap', d.tap)
    await saveContractInFile(networkName, 'TreasuryVault', d.treasury)
    await saveContractInFile(networkName, 'ReserveVault', d.reserve)
    await saveContractInFile(networkName, 'KycAuthorization', d.kyc)
    await saveContractInFile(networkName, 'PreSale', d.preSale)
}

async function saveContractInFile(networkName: string, name: string, contract: BaseContract) {
    let receipt
    if (contract.deployTransaction)
        receipt = await contract.deployTransaction.wait(1)
    else
        receipt = await d.controller.deployTransaction.wait(1)

    saveContractAddress(networkName, name, contract.address, receipt.blockNumber, receipt.blockHash, receipt.transactionHash)
    saveContractAbi(networkName, name, contract.interface.format(FormatTypes.json))
}

deployLocal().catch(error => {
    console.error(error);
    process.exitCode = 1;
})