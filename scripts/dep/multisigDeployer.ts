import { ethers } from "hardhat";
import { CoreMultisig } from "../../typechain";
import { assert } from "chai";
import { isDeployed } from "../utilities";
import { saveContractInFile } from "./_common";
import hre from "hardhat"

export async function deployMultisig(initialMembers: string[]) {
    let networkName = hre.network.name

    console.log()
    console.log("    ********    ")
    console.log("****************")
    console.log("MULTISIG DEPLOYMENT BEGAN ON NETWORK: " + networkName)

    console.log("multisig deploying...")
    let MultisigFactory = await ethers.getContractFactory("CoreMultisig")
    let multisig: CoreMultisig = await MultisigFactory.deploy(initialMembers)
    multisig = await multisig.deployed()
    console.log("multisig deployed at: " + multisig.address)

    await saveContractInFile(networkName, 'CoreMultisig', multisig)
    await multisig.deployTransaction.wait()

    assert.equal(true, await isDeployed(hre, multisig.address))

    console.log("MULTISIG DEPLOYMENT ENDED")
    console.log("****************")
    console.log("    ********    ")
    console.log()

    return multisig
}