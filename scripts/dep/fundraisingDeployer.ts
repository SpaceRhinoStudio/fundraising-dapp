import { ethers } from "hardhat";
import { BancorFormula, Controller, EngaToken, KycAuthorization, MarketMaker, PreSale, Tap, TokenManager, Vault } from "../../typechain";
import { BATCH_BLOCKS, ControllerState, marketMakerConfig, tapConfig } from "../constants";
import { awaitTx } from "../utilities";
import { saveContractInFile } from "./_common";
import { assert } from "chai";
import { deployPreSale } from "./preSaleDeployer";
import { TEMP } from "../offChainKeccakRoles";
import hre from "hardhat"

export async function deployFundraising(owner: string, stakeHolder: string, seedSale: string, collateral: string) {
    let networkName = hre.network.name

    console.log()
    console.log("    ********    ")
    console.log("****************")
    console.log("FUNDRAISING DEPLOYMENT BEGAN ON NETWORK: " + networkName)

    let ControllerFactory = await ethers.getContractFactory("Controller")
    let EngaTokenFactory = await ethers.getContractFactory("EngaToken")
    let TokenManagerFactory = await ethers.getContractFactory("TokenManager")
    let MarketMakerFactory = await ethers.getContractFactory("MarketMaker")
    let BancorFormulaFactory = await ethers.getContractFactory("BancorFormula")
    let TapFactory = await ethers.getContractFactory("Tap")
    let VaultFactory = await ethers.getContractFactory("Vault")
    let KycAuthorizationFactory = await ethers.getContractFactory("KycAuthorization")

    console.log("controller deploying...")
    let controller: Controller = await ControllerFactory.deploy(owner)
    controller = await controller.deployed()
    console.log("controller deployed at: " + controller.address)

    let signer = (await ethers.getSigners())[0]
    let signerAddr = await signer.getAddress()

    assert.equal(await controller.hasRole(TEMP, signerAddr), true, "error: user should have role TEMP")

    console.log("engaToken deploying...")
    let engaToken: EngaToken = await EngaTokenFactory.deploy(controller.address)
    await engaToken.deployed()
    console.log("engaToken deployed at: " + engaToken.address)

    console.log("tokenManager deploying...")
    let tokenManager: TokenManager = await TokenManagerFactory.deploy(controller.address)
    await tokenManager.deployed()
    console.log("tokenManager deployed at: " + tokenManager.address)

    console.log("marketMaker deploying...")
    let marketMaker: MarketMaker = await MarketMakerFactory.deploy(controller.address)
    await marketMaker.deployed()
    console.log("marketMaker deployed at: " + marketMaker.address)

    console.log("bancorFormula deploying...")
    let bancorFormula: BancorFormula = await BancorFormulaFactory.deploy()
    await bancorFormula.deployed()
    console.log("bancorFormula deployed at: " + bancorFormula.address)

    console.log("tap deploying...")
    let tap: Tap = await TapFactory.deploy(controller.address)
    await tap.deployed()
    console.log("tap deployed at: " + tap.address)

    console.log("reserveVault deploying...")
    let reserve: Vault = await VaultFactory.deploy(controller.address)
    await reserve.deployed()
    console.log("reserveVault deployed at: " + reserve.address)

    console.log("treasuryVault deploying...")
    let treasury: Vault = await VaultFactory.deploy(controller.address)
    await treasury.deployed()
    console.log("treasuryVault deployed at: " + treasury.address)

    console.log("kycAuthorization deploying...")
    let kyc: KycAuthorization = await KycAuthorizationFactory.deploy(controller.address)
    await kyc.deployed()
    console.log("kycAuthorization deployed at: " + kyc.address)

    saveContractInFile(networkName, 'Controller', controller)
    saveContractInFile(networkName, 'EngaToken', engaToken)
    saveContractInFile(networkName, 'TokenManager', tokenManager)
    saveContractInFile(networkName, 'MarketMaker', marketMaker)
    saveContractInFile(networkName, 'BancorFormula', bancorFormula)
    saveContractInFile(networkName, 'Tap', tap)
    saveContractInFile(networkName, 'ReserveVault', reserve)
    saveContractInFile(networkName, 'TreasuryVault', treasury)
    saveContractInFile(networkName, 'KycAuthorization', kyc)

    assert.equal(await controller.state(), ControllerState.Constructed, "Controller state is not Constructed")

    console.log("initializing contracts...")
    await awaitTx(controller.initContracts(engaToken.address, tokenManager.address, marketMaker.address, bancorFormula.address, tap.address, reserve.address, treasury.address, kyc.address))
    console.log("initializing contracts done!")

    console.log("assertioning contracts...")
    assert.equal(await controller.state(), ControllerState.ContractsDeployed, "Controller state is not ContractsDeployed")
    assert.equal(engaToken.address, await controller.engaToken(), "EngaToken address is not set correctly")
    assert.equal(tokenManager.address, await controller.tokenManager(), "TokenManager address is not set correctly")
    assert.equal(marketMaker.address, await controller.marketMaker(), "MarketMaker address is not set correctly")
    assert.equal(bancorFormula.address, await controller.bancorFormula(), "BancorFormula address is not set correctly")
    assert.equal(tap.address, await controller.tap(), "Tap address is not set correctly")
    assert.equal(reserve.address, await controller.reserve(), "ReserveVault address is not set correctly")
    assert.equal(treasury.address, await controller.treasury(), "TreasuryVault address is not set correctly")
    assert.equal(kyc.address, await controller.kyc(), "KycAuthorization address is not set correctly")
    console.log("[WELL DONE] assertioning")

    console.log("\n          PreSale is going to begin deploying...")
    let preSale: PreSale = await deployPreSale(controller.address, collateral)
    console.log("            PreSale is deployed successfully!\n")

    console.log("assertioning contracts...")
    assert.equal(await engaToken.isInitialized(), true)
    assert.equal(await tokenManager.isInitialized(), false)
    assert.equal(await marketMaker.isInitialized(), false)
    assert.equal(await tap.isInitialized(), false)
    assert.equal(await treasury.isInitialized(), true)
    assert.equal(await reserve.isInitialized(), true)
    assert.equal(await kyc.isInitialized(), true)
    console.log("[WELL DONE] assertioning")

    console.log("initializing protocol...")
    await awaitTx(controller.initializeProtocol(
        stakeHolder,
        seedSale,
        preSale.address,
        BATCH_BLOCKS,
        marketMakerConfig.buyFeePct,
        marketMakerConfig.sellFeePct,
        tapConfig.maximumTapRateIncreasePct,
        tapConfig.maximumTapFloorDecreasePct
    ))
    console.log("initializing protocol done!")

    console.log("assertioning contracts...")
    assert.equal(await tokenManager.isInitialized(), true)
    assert.equal(await marketMaker.isInitialized(), true)
    assert.equal(await tap.isInitialized(), true)
    assert.equal(await controller.state(), ControllerState.Initialized, "Controller state is not Initialized")
    assert.equal(await controller.hasRole(TEMP, signerAddr), false, "error: user shouldn't have role TEMP")
    console.log("[WELL DONE] assertioning")

    console.log("FUNDRAISING DEPLOYMENT ENDED")
    console.log("****************")
    console.log("    ********    ")

    return { controller, preSale }
}