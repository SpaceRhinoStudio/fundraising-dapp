import { ethers } from "hardhat";
import { PaymentSplitter } from "../../typechain";
import { assert } from "chai";
import { isDeployed } from "../utilities";
import { saveContractInFile } from "./_common";
import hre from "hardhat"

export async function deployStakeHolders(users: string[], shares: number[]) {
    let networkName = hre.network.name

    console.log()
    console.log("    ********    ")
    console.log("****************")
    console.log("StakeHolders DEPLOYMENT BEGAN ON NETWORK: " + networkName)

    console.log("stakeHolder local users deploying...")
    let StakeHoldersFactory = await ethers.getContractFactory("PaymentSplitter")
    let stakeHolders: PaymentSplitter

    stakeHolders = await StakeHoldersFactory.deploy(
        users,
        shares
    )

    stakeHolders = await stakeHolders.deployed()
    console.log("stakeHolder deployed at: " + stakeHolders.address)

    await stakeHolders.deployTransaction.wait()
    await saveContractInFile(networkName, 'StakeHolders', stakeHolders)

    assert.equal(true, await isDeployed(hre, stakeHolders.address))

    console.log("StakeHolders DEPLOYMENT ENDED")
    console.log("****************")
    console.log("    ********    ")
    console.log()

    return stakeHolders
}