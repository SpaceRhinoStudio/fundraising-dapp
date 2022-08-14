import { Signer } from "ethers"
import { ethers } from "hardhat"

import { BancorFormula, Controller, EngaToken, ERC20Mock, KycAuthorization, MarketMaker, CoreMultisig, PreSale, Vault, PaymentSplitter, Tap, TokenManager, SeedSale } from "../../typechain"
import { calculateSyntheticShare, toEth } from "../utilities"
import { deployMultisig } from "./multisigDeployer"
import { deployFundraising } from "./fundraisingDeployer"
import { deploySeedSale } from "./seedSaleDeployer"
import { deployTeamVault } from "./teamVaultDeployer"

export const MAX_UINT256 = ethers.constants.MaxUint256
export let usdToken: ERC20Mock
export let multisig: CoreMultisig
export let seedSale: SeedSale
export let controller: Controller
export let engaToken: EngaToken
export let tokenManager: TokenManager
export let marketMaker: MarketMaker
export let bancor: BancorFormula
export let tap: Tap
export let treasury: Vault
export let reserve: Vault
export let teamVault: PaymentSplitter
export let kyc: KycAuthorization
export let preSale: PreSale
export let owner1: Signer
export let owner2: Signer
export let owner3: Signer
export let owner4: Signer
export let owner5: Signer
export let investor1: Signer
export let investor2: Signer
export let investor3: Signer
export let investor4: Signer
export let investor5: Signer
export let intruder: Signer
export let owner1Addr: string
export let owner2Addr: string
export let owner3Addr: string
export let owner4Addr: string
export let owner5Addr: string
export let investor1Addr: string
export let investor2Addr: string
export let investor3Addr: string
export let investor4Addr: string
export let investor5Addr: string
export let intruderAddr: string

export async function deployContractsForTest() {
    console.log("**********************")
    console.log("[RUNNING] DEPLOY LOCAL")
    console.log("**********************")
    console.log()

    await setupUsers()
    await setupUSDMock()

    multisig = await deployMultisig([owner2Addr, owner1Addr, owner3Addr, owner4Addr, owner5Addr])
    seedSale = await deploySeedSale(multisig.address)
    teamVault = await deployTeamVault([owner1Addr, owner2Addr, owner3Addr, owner4Addr], calculateSyntheticShare(4))

    let result = await deployFundraising(multisig.address, teamVault.address, seedSale.address, usdToken.address)
    controller = result.controller
    preSale = result.preSale

    engaToken = await ethers.getContractAt("EngaToken", await controller.engaToken())
    tokenManager = await ethers.getContractAt("TokenManager", await controller.tokenManager())
    marketMaker = await ethers.getContractAt("MarketMaker", await controller.marketMaker())
    bancor = await ethers.getContractAt("BancorFormula", await controller.bancorFormula())
    tap = await ethers.getContractAt("Tap", await controller.tap())
    treasury = await ethers.getContractAt("Vault", await controller.treasury())
    reserve = await ethers.getContractAt("Vault", await controller.reserve())
    kyc = await ethers.getContractAt("KycAuthorization", await controller.kyc())

    await approveForAllUsers()
    console.log()
    console.log("**********************")
    console.log("[END] LOCAL DEPLOYMENT")
    console.log("**********************")
}

export async function setupUsers() {
    let accounts = await ethers.getSigners()
    owner2 = accounts[0]
    owner2Addr = await owner2.getAddress()

    owner1 = accounts[1]
    owner1Addr = await owner1.getAddress()
    owner3 = accounts[2]
    owner3Addr = await owner3.getAddress()
    owner4 = accounts[3]
    owner4Addr = await owner4.getAddress()
    owner5 = accounts[4]
    owner5Addr = await owner5.getAddress()

    investor1 = accounts[5]
    investor1Addr = await investor1.getAddress()
    investor2 = accounts[6]
    investor2Addr = await investor2.getAddress()
    investor3 = accounts[7]
    investor3Addr = await investor3.getAddress()
    investor4 = accounts[8]
    investor4Addr = await investor4.getAddress()
    investor5 = accounts[9]
    investor5Addr = await investor5.getAddress()

    intruder = accounts[10]
    intruderAddr = await intruder.getAddress()
}

async function setupUSDMock() {
    let TokenFactory = await ethers.getContractFactory("ERC20Mock")
    usdToken = await TokenFactory.deploy("USD", "USD", investor1Addr, toEth(100_000_000))
    await usdToken.deployed()

    await usdToken.mint(investor2Addr, toEth(2_000_000))
    await usdToken.mint(investor3Addr, toEth(5_000_000))
    await usdToken.mint(investor4Addr, toEth(1_000_000))
    await usdToken.mint(investor5Addr, toEth(50_000))
}

async function approveForAllUsers() {
    await usdToken.approveInternal(investor1Addr, preSale.address, MAX_UINT256)
    await usdToken.approveInternal(investor2Addr, preSale.address, MAX_UINT256)
    await usdToken.approveInternal(investor3Addr, preSale.address, MAX_UINT256)
    await usdToken.approveInternal(investor4Addr, preSale.address, MAX_UINT256)

    await usdToken.approveInternal(investor1Addr, marketMaker.address, MAX_UINT256)
    await usdToken.approveInternal(investor2Addr, marketMaker.address, MAX_UINT256)
    await usdToken.approveInternal(investor3Addr, marketMaker.address, MAX_UINT256)
    await usdToken.approveInternal(investor4Addr, marketMaker.address, MAX_UINT256)
}