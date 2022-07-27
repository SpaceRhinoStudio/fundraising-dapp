import { ethers } from "hardhat";
import { SeedSale } from "../../typechain";
import { assert } from "chai";
import { isDeployed } from "../utilities";
import { seedSaleConfig } from "../constants";
import { saveContractInFile } from "./_common";
import hre from "hardhat"

export async function deploySeedSale(multisig: string) {
    let networkName = hre.network.name

    console.log()
    console.log("    ********    ")
    console.log("****************")
    console.log("SEEDSALE DEPLOYMENT BEGAN ON NETWORK: " + networkName)

    console.log("seedSale deploying...")
    let SeedSaleFactory = await ethers.getContractFactory("SeedSale")
    let seedSale: SeedSale = await SeedSaleFactory.deploy(
        multisig,
        seedSaleConfig.daiGoal,
        seedSaleConfig.engaGoal,
        seedSaleConfig.cliffPeroid,
        seedSaleConfig.completePeroid,
        seedSaleConfig.minimumRequiredToken
    )
    seedSale = await seedSale.deployed()
    console.log("seedSale deployed at: " + seedSale.address)
    
    await seedSale.deployTransaction.wait()
    await saveContractInFile(networkName, 'SeedSale', seedSale)

    assert.equal(true, await isDeployed(hre, seedSale.address))

    console.log("SEEDSALE DEPLOYMENT ENDED")
    console.log("****************")
    console.log("    ********    ")
    console.log()

    return seedSale
}