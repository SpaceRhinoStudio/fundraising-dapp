import { ethers } from "hardhat";
import { toEth } from "../utilities";
import { isNetworkDeployable } from "./_common";
import { OWNER_ADDRSS } from "../constants";
import hre from "hardhat"

export async function deploy() {
    let networkName = hre.network.name

    if (isNetworkDeployable(networkName) === false) return

    let signer = (await ethers.getSigners())[0]

    let tokenName = "MOCK_ENGA_USD"
    let tokenSymbol = "EL-USD"
    let initialAccount = await signer.getAddress()
    let tokenBalance = toEth(10_000_000_000)

    console.log("Deployment of Mock DAI token is started...")

    let MockUSDFactory = await ethers.getContractFactory("ERC20Mock", signer)
    let usdMock = await MockUSDFactory.deploy(tokenName, tokenSymbol, initialAccount, tokenBalance)
    await usdMock.deployed()
    console.log("waiting for confirmation...")
    await usdMock.deployTransaction.wait(5)
    console.log("confirmation is done!")
    let deployedAddr = usdMock.address
    
    //let deployedAddr = "0x01Cf32568A9bdcaa6C806E16FaE6D0cb8f052c75"
    //let usdMock = await ethers.getContractAt("ERC20Mock", deployedAddr)

    console.log("Contract deployed at: " + deployedAddr)

    // OWNER_ADDRSS.forEach(async (owner) => {
    //     console.log(`sending funds to ${owner}`)
    //     let tx = await usdMock.transfer(owner, tokenBalance.div(OWNER_ADDRSS.length))
    //     await tx.wait(1)
    // });

    try {
        console.log("waiting for verification...")
        await hre.run("verify:verify", {
            address: deployedAddr,
            constructorArguments: [
                tokenName,
                tokenSymbol,
                initialAccount,
                tokenBalance
            ],
        });
        console.log("verification is done!")
    } catch (error) {
        console.log("*************verification failed!*************")
        console.log(error)
    }
}

deploy().catch(error => {
    console.error(error);
    process.exitCode = 1;
})