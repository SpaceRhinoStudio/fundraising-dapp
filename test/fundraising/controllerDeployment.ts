import { expect } from "chai"
import { ethers } from "hardhat"
import { BYTES32_ZERO, TEMP } from "../../scripts/offChainKeccakRoles"
import { deployPreSale } from "../../scripts/dep/preSaleDeployer"
import { awaitTx, isEthException, toEth } from "../../scripts/utilities"
import { BATCH_BLOCKS, ControllerState, marketMakerConfig, OWNER_SHARES, tapConfig } from "../../scripts/constants"
import { deployMultisig } from "../../scripts/dep/multisigDeployer"
import { deploySeedSale } from "../../scripts/dep/seedSaleDeployer"
import { deployStakeHolders } from "../../scripts/dep/stakeHoldersDeployer"
import * as d from "../../scripts/dep/sharedLocalDeploy"

describe("controller deployment check", async () => {
    it("should deploy controller and don't let others call initialization", async () => {
        await d.setupUsers()

        let TokenFactory = await ethers.getContractFactory("ERC20Mock")
        let usdToken = await TokenFactory.deploy("USD", "USD", d.owner2Addr, toEth(100_000_000))
        await usdToken.deployed()

        let multisig = await deployMultisig([d.owner2Addr, d.owner1Addr, d.owner3Addr, d.owner4Addr, d.owner5Addr])
        let seedSale = await deploySeedSale(multisig.address)
        let stakeHolders = await deployStakeHolders([d.owner1Addr, d.owner2Addr, d.owner3Addr, d.owner4Addr], OWNER_SHARES)

        const DEFAULT_ADMIN_ROLE = BYTES32_ZERO
        const ZERO_ADDRESS = ethers.constants.AddressZero

        let ControllerFactory = await ethers.getContractFactory("Controller")
        let EngaTokenFactory = await ethers.getContractFactory("EngaToken")
        let TokenManagerFactory = await ethers.getContractFactory("TokenManager")
        let MarketMakerFactory = await ethers.getContractFactory("MarketMaker")
        let BancorFormulaFactory = await ethers.getContractFactory("BancorFormula")
        let TapFactory = await ethers.getContractFactory("Tap")
        let VaultFactory = await ethers.getContractFactory("Vault")
        let KycAuthorizationFactory = await ethers.getContractFactory("KycAuthorization")

        let controller = await ControllerFactory.deploy(multisig.address)
        await controller.deployed()

        expect(await controller.hasRole(TEMP, d.owner2Addr)).to.be.true

        let engaToken = await EngaTokenFactory.deploy(controller.address)
        await engaToken.deployed()

        expect(await engaToken.hasRole(DEFAULT_ADMIN_ROLE, controller.address)).to.be.true

        let tokenManager = await TokenManagerFactory.deploy(controller.address)
        await tokenManager.deployed()

        expect(await tokenManager.hasRole(DEFAULT_ADMIN_ROLE, controller.address)).to.be.true

        let marketMaker = await MarketMakerFactory.deploy(controller.address)
        await marketMaker.deployed()

        expect(await marketMaker.hasRole(DEFAULT_ADMIN_ROLE, controller.address)).to.be.true

        let bancorFormula = await BancorFormulaFactory.deploy()
        await bancorFormula.deployed()

        let tap = await TapFactory.deploy(controller.address)
        await tap.deployed()

        expect(await tap.hasRole(DEFAULT_ADMIN_ROLE, controller.address)).to.be.true

        let reserve = await VaultFactory.deploy(controller.address)
        await reserve.deployed()

        expect(await reserve.hasRole(DEFAULT_ADMIN_ROLE, controller.address)).to.be.true

        let treasury = await VaultFactory.deploy(controller.address)
        await treasury.deployed()

        expect(await treasury.hasRole(DEFAULT_ADMIN_ROLE, controller.address)).to.be.true

        let kyc = await KycAuthorizationFactory.deploy(controller.address)
        await kyc.deployed()

        expect(await kyc.hasRole(DEFAULT_ADMIN_ROLE, controller.address)).to.be.true

        expect(await isEthException(controller.connect(d.owner1).initContracts(engaToken.address, tokenManager.address, marketMaker.address, bancorFormula.address, tap.address, reserve.address, treasury.address, kyc.address))).to.be.true

        expect(await controller.engaToken()).to.be.eq(ZERO_ADDRESS)
        expect(await controller.tokenManager()).to.be.eq(ZERO_ADDRESS)
        expect(await controller.marketMaker()).to.be.eq(ZERO_ADDRESS)
        expect(await controller.bancorFormula()).to.be.eq(ZERO_ADDRESS)
        expect(await controller.tap()).to.be.eq(ZERO_ADDRESS)
        expect(await controller.reserve()).to.be.eq(ZERO_ADDRESS)
        expect(await controller.treasury()).to.be.eq(ZERO_ADDRESS)
        expect(await controller.kyc()).to.be.eq(ZERO_ADDRESS)
        expect(await controller.preSale()).to.be.eq(ZERO_ADDRESS)
        expect(await controller.state()).to.be.eq(ControllerState.Constructed)
        await awaitTx(controller.connect(d.owner2).initContracts(engaToken.address, tokenManager.address, marketMaker.address, bancorFormula.address, tap.address, reserve.address, treasury.address, kyc.address))
        expect(await controller.state()).to.be.eq(ControllerState.ContractsDeployed)
        expect(await controller.engaToken()).to.be.eq(engaToken.address)
        expect(await controller.tokenManager()).to.be.eq(tokenManager.address)
        expect(await controller.marketMaker()).to.be.eq(marketMaker.address)
        expect(await controller.bancorFormula()).to.be.eq(bancorFormula.address)
        expect(await controller.tap()).to.be.eq(tap.address)
        expect(await controller.reserve()).to.be.eq(reserve.address)
        expect(await controller.treasury()).to.be.eq(treasury.address)
        expect(await controller.kyc()).to.be.eq(kyc.address)

        expect(await controller.state()).to.be.eq(ControllerState.ContractsDeployed)

        let preSale = await deployPreSale(controller.address, usdToken.address)
        await preSale.deployed()

        expect(await isEthException(
            controller.connect(d.owner1).initializeProtocol(
                stakeHolders.address,
                seedSale.address,
                preSale.address,
                BATCH_BLOCKS,
                marketMakerConfig.buyFeePct,
                marketMakerConfig.sellFeePct,
                tapConfig.maximumTapRateIncreasePct,
                tapConfig.maximumTapRateIncreasePct)
        )).to.be.true


        expect(await engaToken.isInitialized()).to.be.true
        expect(await tokenManager.isInitialized()).to.be.false
        expect(await marketMaker.isInitialized()).to.be.false
        expect(await tap.isInitialized()).to.be.false
        expect(await treasury.isInitialized()).to.be.true
        expect(await reserve.isInitialized()).to.be.true
        expect(await kyc.isInitialized()).to.be.true
        expect(await controller.state()).to.be.eq(ControllerState.ContractsDeployed)
        await awaitTx(controller.connect(d.owner2).initializeProtocol(
            stakeHolders.address,
            seedSale.address,
            preSale.address,
            BATCH_BLOCKS,
            marketMakerConfig.buyFeePct,
            marketMakerConfig.sellFeePct,
            tapConfig.maximumTapRateIncreasePct,
            tapConfig.maximumTapRateIncreasePct)
        )
        expect(await controller.state()).to.be.eq(ControllerState.Initialized)
        expect(await engaToken.isInitialized()).to.be.true
        expect(await tokenManager.isInitialized()).to.be.true
        expect(await marketMaker.isInitialized()).to.be.true
        expect(await tap.isInitialized()).to.be.true
        expect(await treasury.isInitialized()).to.be.true
        expect(await reserve.isInitialized()).to.be.true
        expect(await kyc.isInitialized()).to.be.true

        expect(await controller.hasRole(TEMP, d.owner2Addr)).to.be.false

        expect(await isEthException(controller.connect(d.owner2).initializeProtocol(
            stakeHolders.address,
            seedSale.address,
            preSale.address,
            BATCH_BLOCKS,
            marketMakerConfig.buyFeePct,
            marketMakerConfig.sellFeePct,
            tapConfig.maximumTapRateIncreasePct,
            tapConfig.maximumTapRateIncreasePct)
        ))

        expect(await controller.engaToken()).to.be.eq(engaToken.address)
        expect(await controller.tokenManager()).to.be.eq(tokenManager.address)
        expect(await controller.marketMaker()).to.be.eq(marketMaker.address)
        expect(await controller.bancorFormula()).to.be.eq(bancorFormula.address)
        expect(await controller.tap()).to.be.eq(tap.address)
        expect(await controller.reserve()).to.be.eq(reserve.address)
        expect(await controller.treasury()).to.be.eq(treasury.address)
        expect(await controller.kyc()).to.be.eq(kyc.address)
        expect(await controller.preSale()).to.be.eq(preSale.address)

        expect(await tokenManager.engaToken()).to.be.eq(engaToken.address)

        expect(await marketMaker.controller()).to.be.eq(controller.address)
        expect(await marketMaker.tokenManager()).to.be.eq(tokenManager.address)
        expect(await marketMaker.engaToken()).to.be.eq(engaToken.address)
        expect(await marketMaker.bancor()).to.be.eq(bancorFormula.address)
        expect(await marketMaker.reserve()).to.be.eq(reserve.address)
        expect(await marketMaker.treasury()).to.be.eq(treasury.address)

        expect(await preSale.controller()).to.be.eq(controller.address)
        expect(await preSale.reserve()).to.be.eq(reserve.address)
        expect(await preSale.beneficiary()).to.be.eq(multisig.address)
        expect(await preSale.contributionToken()).to.be.eq(usdToken.address)

        expect(await tap.controller()).to.be.eq(controller.address)
        expect(await tap.reserve()).to.be.eq(reserve.address)
        expect(await tap.beneficiary()).to.be.eq(multisig.address)
    })
})