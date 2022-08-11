import { preSaleConfig, seedSaleConfig, OWNER_ADDRSS, OWNER_SHARES, COLLATERALS } from "../constants";
import { getSavedContractAddresses } from "../fileUtils";
import hre from "hardhat"

let allNetworkContracts = getSavedContractAddresses()
let networkName = hre.network.name
let contracts = allNetworkContracts[networkName]
let collateral = COLLATERALS[networkName as keyof typeof COLLATERALS]

async function verifySeedSale() {
    await hre.run("verify:verify", {
        address: contracts['SeedSale'].address,
        constructorArguments: [
            contracts['GnosisSafe'].address,
            seedSaleConfig.daiGoal,
            seedSaleConfig.engaGoal,
            seedSaleConfig.cliffPeroid,
            seedSaleConfig.completePeroid,
            seedSaleConfig.minimumRequiredToken
        ],
    });
}

async function verifyEngaToken() {
    await hre.run("verify:verify", {
        address: contracts['EngaToken'].address,
        constructorArguments: [
            contracts['Controller'].address
        ],
    });
}

async function verifyTokenManager() {
    await hre.run("verify:verify", {
        address: contracts['TokenManager'].address,
        constructorArguments: [
            contracts['Controller'].address
        ],
    });
}

async function verifyVault() {
    await hre.run("verify:verify", {
        address: contracts['TreasuryVault'].address,
        constructorArguments: [
            contracts['Controller'].address
        ],
    });
}

async function verifyStakeHolders() {
    await hre.run("verify:verify", {
        address: contracts['StakeHolders'].address,
        constructorArguments: [
            OWNER_ADDRSS,
            OWNER_SHARES
        ],
    });
}

async function verifyPreSale() {
    await hre.run("verify:verify", {
        address: contracts['PreSale'].address,
        constructorArguments: [
            contracts['Controller'].address,
            collateral,
            preSaleConfig.goal,
            preSaleConfig.peroid,
            preSaleConfig.exchangeRate,
            preSaleConfig.cliffPeroid,
            preSaleConfig.completePeroid,
            preSaleConfig.beneficiaryPCT,
            preSaleConfig.minimumRequiredToken
        ],
    });
}

async function verifyBancor() {
    await hre.run("verify:verify", {
        address: contracts['BancorFormula'].address,
        constructorArguments: [
        ],
    });
}

async function verifyMarketMaker() {
    await hre.run("verify:verify", {
        address: contracts['MarketMaker'].address,
        constructorArguments: [
            contracts['Controller'].address
        ],
    });
}

async function verifyTap() {
    await hre.run("verify:verify", {
        address: contracts['Tap'].address,
        constructorArguments: [
            contracts['Controller'].address
        ],
    });
}

async function verifyKycAuthorization() {
    await hre.run("verify:verify", {
        address: contracts['KycAuthorization'].address,
        constructorArguments: [
            contracts['Controller'].address
        ],
    });
}

async function verifyController() {
    await hre.run("verify:verify", {
        address: contracts['Controller'].address,
        constructorArguments: [
            contracts['GnosisSafe'].address,
        ],
    });
}

if (!(networkName === 'hardhat' || networkName === 'localhost')) {
    verifySeedSale().catch(err => { console.log(err) });
    verifyPreSale().catch(err => { console.log(err) });
    verifyEngaToken().catch(err => { console.log(err) });
    verifyTokenManager().catch(err => { console.log(err) });
    verifyVault().catch(err => { console.log(err) });
    verifyStakeHolders().catch(err => { console.log(err) });
    verifyBancor().catch(err => { console.log(err) });
    verifyMarketMaker().catch(err => { console.log(err) });
    verifyTap().catch(err => { console.log(err) });
    verifyKycAuthorization().catch(err => { console.log(err) });
    verifyController().catch(err => { console.log(err) });
} else {
    console.log("Verifying is not possible on localhost or hardhat network")
}