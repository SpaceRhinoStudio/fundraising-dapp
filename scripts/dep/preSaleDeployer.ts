import { ethers } from "hardhat"
import { PreSale } from "../../typechain"
import { assert } from "chai"
import { isDeployed } from "../utilities"
import { preSaleConfig } from "../constants"
import { saveContractInFile } from "./_common"
import hre from "hardhat"

export async function deployPreSale(controller: string, collateral: string): Promise<PreSale> {
    let networkName = hre.network.name

    console.log()
    console.log("    ********    ")
    console.log("****************")
    console.log("PRE-SALE DEPLOYMENT BEGAN ON NETWORK: " + networkName)

    console.log("preSale deploying...")
    let PreSaleFactory = await ethers.getContractFactory("PreSale")
    let preSale: PreSale = await PreSaleFactory.deploy(
        controller,
        collateral,
        preSaleConfig.goal,
        preSaleConfig.peroid,
        preSaleConfig.exchangeRate,
        preSaleConfig.cliffPeroid,
        preSaleConfig.completePeroid,
        preSaleConfig.beneficiaryPCT,
        preSaleConfig.minimumRequiredToken
    )
    preSale = await preSale.deployed()
    console.log("preSale deployed at: " + preSale.address)

    await saveContractInFile(networkName, 'PreSale', preSale)
    await preSale.deployTransaction.wait()

    assert.equal(true, await isDeployed(hre, preSale.address))

    console.log("PRE-SALE DEPLOYMENT ENDED")
    console.log("****************")
    console.log("    ********    ")
    console.log()

    return preSale
}