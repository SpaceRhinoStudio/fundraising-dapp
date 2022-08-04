import hre, { ethers } from "hardhat"
import { COLLATERALS } from "./constants"
import { toEth } from "./utilities"

export async function getCollateral() {
    if (hre.network.name === 'hardhat' || hre.network.name === 'localhost') {
        let signer = await ((await ethers.getSigners())[0]).getAddress()
        let TokenFactory = await ethers.getContractFactory("ERC20Mock")
        let usdToken = await TokenFactory.deploy("USD", "USD", signer, toEth(100_000_000))
        await usdToken.deployed()
        return usdToken.address
    } else {
        return COLLATERALS[hre.network.name as keyof typeof COLLATERALS]
    }
}