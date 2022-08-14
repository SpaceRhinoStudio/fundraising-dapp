import { ethers } from "hardhat";
import { PaymentSplitter } from "../../typechain";
import { assert } from "chai";
import { isDeployed } from "../utilities";
import { saveContractInFile } from "./_common";
import hre from "hardhat"

export async function deployTeamVault(users: string[], shares: number[]) {
    let networkName = hre.network.name

    console.log()
    console.log("    ********    ")
    console.log("****************")
    console.log("TeamVault DEPLOYMENT BEGAN ON NETWORK: " + networkName)

    console.log("TeamVault local users deploying...")
    let TeamVaultFactory = await ethers.getContractFactory("PaymentSplitter")
    let TeamVault: PaymentSplitter = await TeamVaultFactory.deploy(
        users,
        shares
    )

    TeamVault = await TeamVault.deployed()
    console.log("TeamVault deployed at: " + TeamVault.address)

    await TeamVault.deployTransaction.wait()
    await saveContractInFile(networkName, 'TeamVault', TeamVault)

    assert.equal(true, await isDeployed(hre, TeamVault.address))

    console.log("TeamVault DEPLOYMENT ENDED")
    console.log("****************")
    console.log("    ********    ")
    console.log()

    return TeamVault
}