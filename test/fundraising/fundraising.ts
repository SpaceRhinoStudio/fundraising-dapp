import { expect } from "chai"
import { BigNumber, BigNumberish, ContractReceipt, Transaction } from "ethers"
import { ethers } from "hardhat"
import { describe } from "mocha"
import hre from "hardhat"

import { BATCH_BLOCKS, calculateInitialReserveBalance, calculatePricePPM, DAO_SHARE, days, SEED_SALE_SHARE, FundraisingState, hours, INITIAL_SHARE_SUPPLY, INITIAL_SUPPLY, marketMakerConfig, mmCollateralConfig, months, PCT, PPM, PUBLIC_SALE_PRICE_PPM, seconds, preSaleConfig, PRE_SALE, STAKE_HOLDER_SHARE, tapConfig, seedSaleConfig } from "../../scripts/constants"
import { BYTES32_ZERO, ADD_COLLATERAL_TOKEN_ROLE, BURNER_ROLE, MINTER_ROLE, OPEN_ROLE, RELEASE_ROLE, REVOKE_ROLE, SUSPEND_ROLE, TRANSFER_ROLE, TREASURY_TRANSFER_ROLE, UPDATE_COLLATERAL_TOKEN_ROLE, UPDATE_FEES_ROLE, UPDATE_FORMULA_ROLE, UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE, UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE, UPDATE_TAPPED_TOKEN_ROLE, VESTING_ROLE } from "../../scripts/offChainKeccakRoles"
import { PreSale } from "../../typechain"
import { awaitTx, calculateSyntheticShare, currentBlockNumber, currentNetworkTime, encodeParams, getTime, getTimeNow, isEthException, isThrownError, log, mineBlock, toEth, waitForSomeTimeNetwork } from "../../scripts/utilities"
import { deployPreSale } from "../../scripts/dep/preSaleDeployer"
import * as d from "../../scripts/dep/sharedLocalDeploy"

const SUPPLY_FAULT_TOLERANCE = toEth(0.25)
export const MAX_UINT256 = ethers.constants.MaxUint256

// Converts a tap rate to its monthly rate
export const toMonthlyAllocationTest = (value: BigNumberish) => { return BigNumber.from(value) }
// Converts a monthly rate to its tap rate (wei/block)
export const fromMonthlyAllocationTest = (value: BigNumberish) => { return BigNumber.from(value) }

const tapTokenConfigTest = {
    rate: fromMonthlyAllocationTest(toEth(1_000)),
    floor: toEth(10_000),
}

let newPreSale: PreSale

// receipt of a transaction
let t: Transaction
let r: ContractReceipt

let vestedIds = {
    1: new Array<string>(),
    2: new Array<string>(),
    3: new Array<string>(),
    4: new Array<string>(),
}

async function setup() {
    log("****************")
    log("SETUP RUNNING")
    log("****************")
    log("")

    await d.deployContractsForTest()

    newPreSale = await deployPreSale(d.controller.address, d.usdToken.address)

    vestedIds[1] = new Array<string>()
    vestedIds[2] = new Array<string>()
    vestedIds[3] = new Array<string>()
    vestedIds[4] = new Array<string>()

    log("")
    log("****************")
    log("SETUP ENDED")
    log("****************")
}

describe("Fundraising", async () => {
    before(async () => {
        await setup()
    })

    describe("Investors USD", async () => {
        it("should check investors' address to have enough balance of mock usd", async () => {
            expect(await d.usdToken.balanceOf(d.investor1Addr)).to.be.eq(toEth(100_000_000))
            expect(await d.usdToken.balanceOf(d.investor2Addr)).to.be.eq(toEth(2_000_000))
            expect(await d.usdToken.balanceOf(d.investor3Addr)).to.be.eq(toEth(5_000_000))
            expect(await d.usdToken.balanceOf(d.investor4Addr)).to.be.eq(toEth(1_000_000))
            expect(await d.usdToken.balanceOf(d.investor5Addr)).to.be.eq(toEth(50_000))
            expect(await d.usdToken.balanceOf(d.owner2Addr)).to.be.eq(0)
        })
    })

    describe("initial deployment", async () => {
        it("should check keccak256 created off-line for roles given to save gas", async () => {
            expect((await d.engaToken.BURNER_ROLE()).toLocaleLowerCase()).to.be.eq(BURNER_ROLE.toLowerCase())
            expect((await d.engaToken.MINTER_ROLE()).toLocaleLowerCase()).to.be.eq(MINTER_ROLE.toLowerCase())

            expect((await d.tokenManager.BURNER_ROLE()).toLowerCase()).to.be.eq(BURNER_ROLE.toLowerCase())
            expect((await d.tokenManager.MINTER_ROLE()).toLowerCase()).to.be.eq(MINTER_ROLE.toLowerCase())

            expect((await d.reserve.TRANSFER_ROLE()).toLowerCase()).to.be.eq(TRANSFER_ROLE.toLowerCase())

            expect((await d.controller.MINTER_ROLE()).toLowerCase()).to.be.eq(MINTER_ROLE.toLowerCase())
            expect((await d.controller.BURNER_ROLE()).toLowerCase()).to.be.eq(BURNER_ROLE.toLowerCase())
            expect((await d.controller.SUSPEND_ROLE()).toLowerCase()).to.be.eq(SUSPEND_ROLE.toLowerCase())
            expect((await d.controller.UPDATE_FEES_ROLE()).toLowerCase()).to.be.eq(UPDATE_FEES_ROLE.toLowerCase())
            expect((await d.controller.UPDATE_COLLATERAL_TOKEN_ROLE()).toLowerCase()).to.be.eq(UPDATE_COLLATERAL_TOKEN_ROLE.toLowerCase())
            expect((await d.controller.UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE()).toLowerCase()).to.be.eq(UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE.toLowerCase())
            expect((await d.controller.UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE()).toLowerCase()).to.be.eq(UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE.toLowerCase())
            expect((await d.controller.UPDATE_TAPPED_TOKEN_ROLE()).toLowerCase()).to.be.eq(UPDATE_TAPPED_TOKEN_ROLE.toLowerCase())
            expect((await d.controller.TREASURY_TRANSFER_ROLE()).toLowerCase()).to.be.eq(TREASURY_TRANSFER_ROLE.toLowerCase())
            expect((await d.controller.TRANSFER_ROLE()).toLowerCase()).to.be.eq(TRANSFER_ROLE.toLowerCase())
            expect((await d.controller.VESTING_ROLE()).toLowerCase()).to.be.eq(VESTING_ROLE.toLowerCase())
            expect((await d.controller.REVOKE_ROLE()).toLowerCase()).to.be.eq(REVOKE_ROLE.toLowerCase())
            expect((await d.controller.RELEASE_ROLE()).toLowerCase()).to.be.eq(RELEASE_ROLE.toLowerCase())
        })

        it("should check the token supply", async () => {
            expect(await d.engaToken.totalSupply()).to.be.eq(INITIAL_SHARE_SUPPLY)

            expect((await d.tokenManager.getLastVestingForHolder(d.treasury.address)).amountTotal).to.be.eq(DAO_SHARE)
            expect((await d.tokenManager.getLastVestingForHolder(d.stakeHolders.address)).amountTotal).to.be.eq(STAKE_HOLDER_SHARE)
            expect(await d.engaToken.balanceOf(d.seedSale.address)).to.be.eq(SEED_SALE_SHARE)
        })

        describe("should check passed addresses and arguments", async () => {
            it("should check addresses passed to token manager", async () => {
                expect(await d.tokenManager.getEngaToken()).to.be.eq(await d.controller.engaToken())
            })

            it("should check the address of core memebrs in StakeHolders", async () => {
                expect(await d.stakeHolders.payee(0)).to.be.eq(d.owner1Addr)
                expect(await d.stakeHolders.payee(1)).to.be.eq(d.owner2Addr)
                expect(await d.stakeHolders.payee(2)).to.be.eq(d.owner3Addr)
                expect(await d.stakeHolders.payee(3)).to.be.eq(d.owner4Addr)
            })

            it("should check addresses passed to tap", async () => {
                expect(await d.tap.controller()).to.be.eq(d.controller.address)
                expect(await d.tap.reserve()).to.be.eq(await d.controller.reserve())
                expect(await d.tap.beneficiary()).to.be.eq(d.multisig.address)
                expect(await d.tap.batchBlocks()).to.be.eq(BATCH_BLOCKS)
                expect(await d.tap.maximumTapRateIncreasePct()).to.be.eq(tapConfig.maximumTapRateIncreasePct)
                expect(await d.tap.maximumTapFloorDecreasePct()).to.be.eq(tapConfig.maximumTapFloorDecreasePct)
            })

            it("should check addresses passed to PreSale", async () => {
                expect(await d.preSale.controller()).to.be.eq(d.controller.address)
                expect(await d.preSale.reserve()).to.be.eq(await d.controller.reserve())
                expect(await d.preSale.beneficiary()).to.be.eq(d.multisig.address)
                expect(await d.preSale.contributionToken()).to.be.eq(d.usdToken.address)
                expect(await d.preSale.goal()).to.be.eq(preSaleConfig.goal)
                expect(await d.preSale.period()).to.be.eq(preSaleConfig.peroid)
                expect(await d.preSale.exchangeRate()).to.be.eq(preSaleConfig.exchangeRate)
                expect(await d.preSale.vestingCliffPeriod()).to.be.eq(preSaleConfig.cliffPeroid)
                expect(await d.preSale.vestingCompletePeriod()).to.be.eq(preSaleConfig.completePeroid)
                expect(await d.preSale.fundingForBeneficiaryPct()).to.be.eq(preSaleConfig.beneficiaryPCT)
                expect(await d.preSale.minimumRequiredToken()).to.be.eq(preSaleConfig.minimumRequiredToken)
            })

            it("should check addresses passed to marketMaker", async () => {
                expect(await d.marketMaker.controller()).to.be.eq(d.controller.address)
                expect(await d.marketMaker.engaToken()).to.be.eq(await d.controller.engaToken())
                expect(await d.marketMaker.tokenManager()).to.be.eq(await d.controller.tokenManager())
                expect(await d.marketMaker.reserve()).to.be.eq(await d.controller.reserve())
                expect(await d.marketMaker.treasury()).to.be.eq(await d.controller.treasury())
                expect(await d.marketMaker.bancor()).to.be.eq(await d.controller.bancorFormula())
                expect(await d.marketMaker.batchBlocks()).to.be.eq(BATCH_BLOCKS)
                expect(await d.marketMaker.buyFeePct()).to.be.eq(marketMakerConfig.buyFeePct)
                expect(await d.marketMaker.sellFeePct()).to.be.eq(marketMakerConfig.sellFeePct)
            })

            it("should check addresses received back from controller", async () => {
                expect(await d.controller.owner()).to.be.eq(d.multisig.address)
                expect(await d.controller.beneficiary()).to.be.eq(d.multisig.address)
                expect(await d.controller.engaToken()).to.be.eq(d.engaToken.address)
                expect(await d.controller.tokenManager()).to.be.eq(d.tokenManager.address)
                expect(await d.controller.marketMaker()).to.be.eq(d.marketMaker.address)
                expect(await d.controller.bancorFormula()).to.be.eq(d.bancor.address)
                expect(await d.controller.tap()).to.be.eq(d.tap.address)
                expect(await d.controller.treasury()).to.be.eq(d.treasury.address)
                expect(await d.controller.reserve()).to.be.eq(d.reserve.address)
                expect(await d.controller.kyc()).to.be.eq(d.kyc.address)
                expect(await d.controller.preSale()).to.be.eq(d.preSale.address)
            })

            it("should check kyc", async () => {
                expect(await d.kyc.isKycEnable()).to.be.false
            })
        })

        it("should check for all roles given at initial deploy", async () => {
            let DEFAULT_ADMIN_ROLE = BYTES32_ZERO

            expect(await d.engaToken.hasRole(MINTER_ROLE, d.tokenManager.address)).to.be.true
            expect(await d.engaToken.hasRole(BURNER_ROLE, d.tokenManager.address)).to.be.true
            expect(await d.engaToken.hasRole(DEFAULT_ADMIN_ROLE, d.multisig.address)).to.be.false
            expect(await d.engaToken.hasRole(DEFAULT_ADMIN_ROLE, d.controller.address)).to.be.true

            expect(await d.tokenManager.hasRole(MINTER_ROLE, d.marketMaker.address)).to.be.true
            expect(await d.tokenManager.hasRole(BURNER_ROLE, d.marketMaker.address)).to.be.true
            expect(await d.tokenManager.hasRole(DEFAULT_ADMIN_ROLE, d.multisig.address)).to.be.false
            expect(await d.tokenManager.hasRole(DEFAULT_ADMIN_ROLE, d.controller.address)).to.be.true

            expect(await d.reserve.hasRole(TRANSFER_ROLE, d.marketMaker.address)).to.be.true
            expect(await d.reserve.hasRole(TRANSFER_ROLE, d.tap.address)).to.be.true
            expect(await d.reserve.hasRole(DEFAULT_ADMIN_ROLE, d.multisig.address)).to.be.false
            expect(await d.reserve.hasRole(DEFAULT_ADMIN_ROLE, d.controller.address)).to.be.true

            expect(await d.treasury.hasRole(DEFAULT_ADMIN_ROLE, d.multisig.address)).to.be.false
            expect(await d.treasury.hasRole(DEFAULT_ADMIN_ROLE, d.controller.address)).to.be.true

            expect(await d.preSale.hasRole(DEFAULT_ADMIN_ROLE, d.multisig.address)).to.be.false
            expect(await d.preSale.hasRole(DEFAULT_ADMIN_ROLE, d.controller.address)).to.be.true

            expect(await d.marketMaker.hasRole(DEFAULT_ADMIN_ROLE, d.multisig.address)).to.be.false
            expect(await d.marketMaker.hasRole(DEFAULT_ADMIN_ROLE, d.controller.address)).to.be.true

            expect(await d.tap.hasRole(DEFAULT_ADMIN_ROLE, d.multisig.address)).to.be.false
            expect(await d.tap.hasRole(DEFAULT_ADMIN_ROLE, d.controller.address)).to.be.true

            expect(await d.kyc.hasRole(DEFAULT_ADMIN_ROLE, d.multisig.address)).to.be.false
            expect(await d.kyc.hasRole(DEFAULT_ADMIN_ROLE, d.controller.address)).to.be.true

            expect(await d.controller.hasRole(DEFAULT_ADMIN_ROLE, d.multisig.address)).to.be.true
            expect(await d.controller.hasRole(VESTING_ROLE, d.preSale.address)).to.be.true
            expect(await d.controller.hasRole(REVOKE_ROLE, d.preSale.address)).to.be.true
            expect(await d.controller.hasRole(ADD_COLLATERAL_TOKEN_ROLE, d.owner2Addr)).to.be.false
            expect(await d.controller.hasRole(ADD_COLLATERAL_TOKEN_ROLE, d.owner1Addr)).to.be.false
        })

        it("should error while memebrs want to open the sale", async () => {
            expect(await isEthException(d.controller.connect(d.owner2).openSaleNow()))
            expect(await isEthException(d.controller.connect(d.owner1).openSaleNow()))
        })
    })

    describe("process", async () => {
        it("should not allow anyone to call mint or burn", async () => {
            expect(await isEthException(d.engaToken.burn(d.tokenManager.address, toEth(200_000)))).to.be.true
            expect(await isEthException(d.engaToken.mint(d.tokenManager.address, toEth(200_000)))).to.be.true
            expect(await isEthException(d.engaToken.connect(d.investor1).burn(d.tokenManager.address, toEth(200_000)))).to.be.true
            expect(await isEthException(d.engaToken.connect(d.investor1).mint(d.tokenManager.address, toEth(200_000)))).to.be.true
            expect(await isEthException(d.engaToken.connect(d.intruder).burn(d.tokenManager.address, toEth(200_000)))).to.be.true
            expect(await isEthException(d.engaToken.connect(d.intruder).mint(d.tokenManager.address, toEth(200_000)))).to.be.true
        })

        describe("PreSale process - Towards failure on fundraising", async () => {
            it("should ckeck the state of the sale", async () => {
                expect(await d.preSale.state()).to.be.eq(FundraisingState.Pending)
            })

            it("should check that open date is zero", async () => {
                expect(await d.preSale.openDate()).to.be.eq(0)
            })

            it("should not allow arbitrary user to open the gate", async () => {
                expect(await isEthException(d.preSale.connect(d.owner2).openNow())).to.be.true
                expect(await isEthException(d.preSale.connect(d.owner1).openNow())).to.be.true
                expect(await isEthException(d.preSale.connect(d.intruder).openNow())).to.be.true
                expect(await isEthException(d.preSale.connect(d.owner1).openByDate(getTime(2022, 3, 16)))).to.be.true
                expect(await isEthException(d.preSale.connect(d.intruder).openByDate(getTime(2022, 3, 16)))).to.be.true
            })

            it("should prevent any buyer from contributing to the sale before opening", async () => {
                expect(await d.usdToken.allowance(d.investor1Addr, d.preSale.address)).to.be.eq(MAX_UINT256)
                expect(await d.usdToken.allowance(d.investor2Addr, d.preSale.address)).to.be.eq(MAX_UINT256)
                expect(await d.usdToken.allowance(d.investor3Addr, d.preSale.address)).to.be.eq(MAX_UINT256)
                expect(await d.usdToken.allowance(d.investor4Addr, d.preSale.address)).to.be.eq(MAX_UINT256)
                expect(await d.usdToken.allowance(d.investor5Addr, d.preSale.address)).to.be.eq(0)

                expect(await isEthException(d.controller.connect(d.investor1).contribute(toEth(10_000)))).to.be.true
            })

            it("should calculate the amount of exchange correctly", async () => {
                expect(await d.preSale.contributionToTokens(toEth(10))).to.be.eq(BigNumber.from(toEth(10)).mul(preSaleConfig.exchangeRate).div(PPM))
                expect(await d.preSale.tokenToContributions(toEth(100))).to.be.eq(BigNumber.from(toEth(100)).mul(PPM).div(preSaleConfig.exchangeRate))
            })

            it("should open the gate with time one day passed from now and prevent setting it again", async () => {
                let time = getTimeNow()
                expect(await openSaleByDate(time + days)).to.be.true

                expect(await d.preSale.openDate()).to.be.eq(time + days)
                expect(await d.preSale.state()).to.be.eq(FundraisingState.Pending)

                expect(await openSaleNow()).to.be.eq(false)
                expect(await openSaleByDate(time + 3 * days)).to.be.false
            })

            it("should still prevent users from buying", async () => {
                expect(await isEthException(d.controller.connect(d.investor1).contribute(toEth(1000))))
                expect(await isEthException(d.controller.connect(d.investor2).contribute(toEth(1000))))
            })

            it("some time should be passed to change the state to Funding", async () => {
                await waitFor(days + 1 * seconds)
                expect(await d.preSale.state()).to.be.eq(FundraisingState.Funding)
            })

            it("should not let contributors to invest when kyc is enable", async () => {
                let res = await multisigCall(d.controller.address, 'enableKyc()', encodeParams([], []))
                expect((await d.multisig.transactions(res.id)).executed).to.be.true

                expect(await isEthException(d.controller.connect(d.investor1).contribute(toEth(1_000)))).to.be.true
                expect(await isEthException(d.controller.connect(d.investor2).contribute(toEth(1_000)))).to.be.true
                expect(await isEthException(d.controller.connect(d.investor3).contribute(toEth(1_000)))).to.be.true

                expect(await isEthException(d.kyc.connect(d.owner2).addKycUser(d.investor4Addr))).to.be.true
                expect(await isEthException(d.kyc.connect(d.owner1).addKycUser(d.investor4Addr))).to.be.true

                res = await multisigCall(d.controller.address, 'addKycUser(address)', encodeParams(['address'], [d.investor4Addr]))
                expect((await d.multisig.transactions(res.id)).executed).to.be.true

                expect(await d.controller.getKycOfUser(d.investor4Addr)).to.be.true
                expect(await d.kyc.getKycOfUser(d.investor4Addr)).to.be.true
            })

            it("should not allow users contribute directly on presale", async () => {
                expect(await isEthException(d.preSale.connect(d.investor4).contribute(d.investor4Addr, toEth(70_000))))
                expect(await isEthException(d.preSale.connect(d.owner2).contribute(d.investor4Addr, toEth(70_000))))
                expect(await isEthException(d.preSale.connect(d.owner1).contribute(d.investor4Addr, toEth(70_000))))
            })

            it("should allow users to contribute and then close kyc", async () => {
                r = await awaitTx(d.controller.connect(d.investor4).contribute(toEth(70_000)))
                vestedIds[4].push(await getLastVestingId(d.investor4Addr))

                let res = await multisigCall(d.controller.address, 'disableKyc()', encodeParams([], []))
                expect((await d.multisig.transactions(res.id)).executed).to.be.true
            })

            it("should prevent buyers from orders below minimum required token", async () => {
                let minimum = preSaleConfig.minimumRequiredToken.sub(1)
                expect(await isEthException(d.controller.connect(d.investor1).contribute(minimum)))
            })

            it("should let buyers to contribute when enough time has passed", async () => {
                r = await awaitTx(d.controller.connect(d.investor1).contribute(toEth(100_000)))
                let vestId = await getLastVestingId(d.investor1Addr)
                vestedIds[1].push(vestId)
                expect((await d.tokenManager.getVesting(vestId)).vestingCreator).to.be.eq(d.preSale.address)

                r = await awaitTx(d.controller.connect(d.investor2).contribute(toEth(10_000)))
                vestId = await getLastVestingId(d.investor2Addr)
                vestedIds[2].push(vestId)
                expect((await d.tokenManager.getVesting(vestId)).vestingCreator).to.be.eq(d.preSale.address)

                r = await awaitTx(d.controller.connect(d.investor3).contribute(toEth(10_000)))
                vestId = await getLastVestingId(d.investor3Addr)
                vestedIds[3].push(vestId)
                expect((await d.tokenManager.getVesting(vestId)).vestingCreator).to.be.eq(d.preSale.address)

                let raised = await d.preSale.totalRaised()
                let newSupply = await d.preSale.contributionToTokens((raised))
                expect(raised).to.be.eq(toEth(190_000))
                expect(await d.engaToken.totalSupply()).to.be.eq(INITIAL_SHARE_SUPPLY.add(newSupply))

                expect(await d.tokenManager.getWithdrawableAmount()).to.be.eq(0)
            })

            it("should check the vested items integrity", async () => {
                let time = await getCurrentNetworkTime()
                let vest = await d.tokenManager.getVesting(vestedIds[1][0])
                expect(vest.beneficiary).to.be.eq(d.investor1Addr)
                expect(vest.amountTotal).to.be.eq(await d.preSale.contributionToTokens(toEth(100_000)))
                expect(vest.released).to.be.eq(0)
                expect(vest.revocable).to.be.true
                expect(vest.revoked).to.be.false
                expect(Number(vest.start)).to.be.greaterThanOrEqual(time - 3)
                expect(Number(vest.cliff)).to.be.greaterThanOrEqual(Number(vest.start) + preSaleConfig.cliffPeroid)
                expect(Number(vest.end)).to.be.greaterThanOrEqual(Number(vest.start) + preSaleConfig.completePeroid)
            })

            it("should check the state to be Funding as before after passing half of the time", async () => {
                waitFor(preSaleConfig.peroid / 2)
                expect(await d.preSale.state()).to.be.eq(FundraisingState.Funding)
            })

            it("should not allow to users to revoke thier vesting peroid of fundraising", async () => {
                expect(await isEthException(d.tokenManager.revoke(vestedIds[1][0]))).to.be.true
                expect(await isEthException(d.tokenManager.revoke(vestedIds[2][0]))).to.be.true
                expect(await isEthException(d.tokenManager.revoke(vestedIds[3][0]))).to.be.true
                expect(await isEthException(d.tokenManager.revoke(vestedIds[4][0]))).to.be.true

                expect(await isEthException(d.controller.refund(d.investor1Addr, vestedIds[1][0]))).to.be.true
                expect(await isEthException(d.controller.refund(d.investor2Addr, vestedIds[2][0]))).to.be.true
                expect(await isEthException(d.controller.refund(d.investor3Addr, vestedIds[3][0]))).to.be.true
                expect(await isEthException(d.controller.refund(d.investor4Addr, vestedIds[4][0]))).to.be.true
            })

            it("should not allow users to call directly on tokenManager", async () => {
                expect(await isEthException(d.tokenManager.connect(d.owner1).release(vestedIds[1][0]))).to.be.true
                expect(await isEthException(d.tokenManager.connect(d.owner2).release(vestedIds[2][0]))).to.be.true
                expect(await isEthException(d.tokenManager.connect(d.owner3).release(vestedIds[3][0]))).to.be.true
                expect(await isEthException(d.tokenManager.connect(d.owner4).release(vestedIds[4][0]))).to.be.true

                expect(await isEthException(d.tokenManager.connect(d.investor1).release(vestedIds[4][0]))).to.be.true
                expect(await isEthException(d.tokenManager.connect(d.investor2).release(vestedIds[4][0]))).to.be.true
                expect(await isEthException(d.tokenManager.connect(d.investor3).release(vestedIds[4][0]))).to.be.true
                expect(await isEthException(d.tokenManager.connect(d.investor4).release(vestedIds[4][0]))).to.be.true
            })

            it("should not allow to users to release thier vesting before cliff", async () => {
                expect(await isEthException(d.controller.release(vestedIds[1][0]))).to.be.true
                expect(await isEthException(d.controller.release(vestedIds[2][0]))).to.be.true
                expect(await isEthException(d.controller.release(vestedIds[3][0]))).to.be.true
                expect(await isEthException(d.controller.release(vestedIds[4][0]))).to.be.true
            })

            it("should check the state to be refunding because time has ended", async () => {
                waitFor(preSaleConfig.peroid / 2 + 2)
                expect(await d.preSale.state()).to.be.eq(FundraisingState.Refunding)
            })

            it("should not let users buy when fundraising is in state Refund", async () => {
                expect(await isEthException(d.controller.connect(d.investor1).contribute(toEth(200_000))))
                expect(await isEthException(d.controller.connect(d.investor2).contribute(toEth(200_000))))
            })

            it("should not allow users to release vestings, only revoke can be called", async () => {
                let nowtime = await getCurrentNetworkTime()
                let cliffTime = (await d.tokenManager.getVesting(vestedIds[4][0])).cliff
                let diff = Number(cliffTime) - nowtime
                waitFor(diff + 1)
                // it's time to release prevoius fundraising, we don't allow it
                expect(await isEthException(d.tokenManager.release(vestedIds[4][0]))).to.be.true
                expect(await isEthException(d.controller.release(vestedIds[4][0]))).to.be.true
            })

            it("should allow buyers to refund their vesting and check that their vesting is revoked in amount", async () => {
                let totalSupply = await d.engaToken.totalSupply()

                expect(await d.preSale.contributions(d.investor1Addr, vestedIds[1][0])).to.be.eq(toEth(100_000))
                await awaitTx(d.preSale.refund(d.investor1Addr, vestedIds[1][0]))
                expect(await d.preSale.contributions(d.investor1Addr, vestedIds[1][0])).to.be.eq(toEth(0))
                expect(await isEthException(d.preSale.refund(d.investor1Addr, vestedIds[1][0])))

                expect(await d.preSale.contributions(d.investor2Addr, vestedIds[2][0])).to.be.eq(toEth(10_000))
                await awaitTx(d.preSale.refund(d.investor2Addr, vestedIds[2][0]))
                expect(await d.preSale.contributions(d.investor2Addr, vestedIds[2][0])).to.be.eq(toEth(0))
                expect(await isEthException(d.preSale.refund(d.investor2Addr, vestedIds[2][0])))

                expect(await d.preSale.contributions(d.investor3Addr, vestedIds[3][0])).to.be.eq(toEth(10_000))
                await awaitTx(d.preSale.refund(d.investor3Addr, vestedIds[3][0]))
                expect(await d.preSale.contributions(d.investor3Addr, vestedIds[3][0])).to.be.eq(toEth(0))
                expect(await isEthException(d.preSale.refund(d.investor3Addr, vestedIds[3][0])))

                expect(await d.preSale.contributions(d.investor4Addr, vestedIds[4][0])).to.be.eq(toEth(70_000))
                await awaitTx(d.preSale.refund(d.investor4Addr, vestedIds[4][0]))
                expect(await d.preSale.contributions(d.investor4Addr, vestedIds[4][0])).to.be.eq(toEth(0))
                expect(await isEthException(d.preSale.refund(d.investor4Addr, vestedIds[4][0])))

                let raised = toEth(190_000)
                let burnedSupply = await d.preSale.contributionToTokens((raised))
                expect(await d.engaToken.totalSupply()).to.be.eq(totalSupply.sub(burnedSupply))
            })

            it("should check the vesting for user after revoke", async () => {
                let vest = await d.tokenManager.getVesting(vestedIds[1][0])
                expect(vest.revoked).to.be.true
            })

            it("should check the supply", async () => {
                expect(await d.engaToken.totalSupply()).to.be.eq(INITIAL_SHARE_SUPPLY)
            })

            it("should check investors' addresses to have enough balance of mock usd after Refund", async () => {
                expect(await d.usdToken.balanceOf(d.investor1Addr)).to.be.eq(toEth(100_000_000))
                expect(await d.usdToken.balanceOf(d.investor2Addr)).to.be.eq(toEth(2_000_000))
                expect(await d.usdToken.balanceOf(d.investor3Addr)).to.be.eq(toEth(5_000_000))
                expect(await d.usdToken.balanceOf(d.investor4Addr)).to.be.eq(toEth(1_000_000))
                expect(await d.usdToken.balanceOf(d.investor5Addr)).to.be.eq(toEth(50_000))
                expect(await d.usdToken.balanceOf(d.owner2Addr)).to.be.eq(0)
            })

            describe("after one failure we could proceed for another PreSale", async () => {
                it("should check for permissions before setting new sale", async () => {
                    expect(await d.controller.hasRole(VESTING_ROLE, d.preSale.address)).to.be.true
                    expect(await d.controller.hasRole(REVOKE_ROLE, d.preSale.address)).to.be.true
                    expect(await d.controller.hasRole(VESTING_ROLE, newPreSale.address)).to.be.false
                    expect(await d.controller.hasRole(REVOKE_ROLE, newPreSale.address)).to.be.false
                })

                it("should allow to have extraSale", async () => {
                    expect(await newPreSale.state()).to.be.eq(FundraisingState.Pending)
                    expect(await isEthException(newPreSale.openNow())).to.be.true

                    let res = await multisigCall(d.controller.address, 'setNewSaleAddress(address)', encodeParams(['address'], [newPreSale.address]))
                    expect((await d.multisig.transactions(res.id)).executed).to.be.true

                    expect(await d.controller.preSale()).to.be.eq(newPreSale.address)
                    expect(await newPreSale.state()).to.be.eq(FundraisingState.Pending)
                })

                it("should not allow users to contribute when preSale is in refunding state", async () => {
                    expect(await d.preSale.state()).to.be.eq(FundraisingState.Refunding)
                    expect(await isEthException(d.controller.connect(d.investor1).contribute(toEth(1000)))).to.be.true
                    expect(await isEthException(d.controller.connect(d.investor2).contribute(toEth(1000)))).to.be.true
                })

                it("should check for permissions after setting new sale", async () => {
                    expect(await d.controller.hasRole(VESTING_ROLE, d.preSale.address)).to.be.false
                    expect(await d.controller.hasRole(REVOKE_ROLE, d.preSale.address)).to.be.true
                    expect(await d.controller.hasRole(VESTING_ROLE, newPreSale.address)).to.be.true
                    expect(await d.controller.hasRole(REVOKE_ROLE, newPreSale.address)).to.be.true
                })

                it("should allow users to contribute to the newSale", async () => {
                    expect(await isEthException(newPreSale.openNow()))
                    expect(await openSaleNow()).to.be.true

                    expect(await newPreSale.state()).to.be.eq(FundraisingState.Funding)
                    expect(await newPreSale.totalRaised()).to.be.eq(0)

                    await awaitTx(d.usdToken.connect(d.investor1).approve(newPreSale.address, toEth(5000)))
                    await awaitTx(d.controller.connect(d.investor1).contribute(toEth(1000)))

                    expect(await newPreSale.totalRaised()).to.be.eq(toEth(1000))
                })

                it("should not check the scenario when we want to add another extraSale", async () => {
                    expect(await newPreSale.state()).to.be.eq(FundraisingState.Funding)

                    let extraSale = await deployPreSale(d.controller.address, d.usdToken.address)

                    let res = await multisigCall(d.controller.address, 'setNewSaleAddress(address)', encodeParams(['address'], [extraSale.address]))
                    expect((await d.multisig.transactions(res.id)).executed).to.be.false

                    // Wait for some time to let newSale change its state to Refunding
                    await waitFor(preSaleConfig.peroid)
                    expect(await newPreSale.state()).to.be.eq(FundraisingState.Refunding)

                    // We can add another extraSale
                    res = await multisigCall(d.controller.address, 'setNewSaleAddress(address)', encodeParams(['address'], [extraSale.address]))
                    expect((await d.multisig.transactions(res.id)).executed).to.be.true

                    // open extraSale
                    expect(await openSaleNow()).to.be.true
                    expect(await d.controller.preSale()).to.be.eq(extraSale.address)

                    // participate on extaSale and make its state GoalReached
                    await awaitTx(d.usdToken.connect(d.investor1).approve(extraSale.address, toEth(500_000)))
                    await awaitTx(d.controller.connect(d.investor1).contribute(toEth(500_000)))
                    expect(await extraSale.totalRaised()).to.be.eq(preSaleConfig.goal)
                    expect(await extraSale.state()).to.be.eq(FundraisingState.GoalReached)
                    // close the sale
                    await awaitTx(d.controller.closeSale())
                    expect(await extraSale.state()).to.be.eq(FundraisingState.Closed)
                })

                it("should allow owners to add another sale even when PreSale went successfully", async () => {
                    let finalPreSale = await deployPreSale(d.controller.address, d.usdToken.address)
                    let { id } = await multisigCall(d.controller.address, 'setNewSaleAddress(address)', encodeParams(['address'], [finalPreSale.address]))
                    expect((await d.multisig.transactions(id)).executed).to.be.true
                    expect(await finalPreSale.state()).to.be.eq(FundraisingState.Pending)
                    expect(await d.controller.preSale()).to.be.eq(finalPreSale.address)

                    expect(await openSaleNow()).to.be.true

                    await awaitTx(d.usdToken.connect(d.investor1).approve(finalPreSale.address, toEth(500_000)))
                    await awaitTx(d.controller.connect(d.investor1).contribute(toEth(500_000)))
                    expect(await finalPreSale.totalRaised()).to.be.eq(preSaleConfig.goal)
                    expect(await finalPreSale.state()).to.be.eq(FundraisingState.GoalReached)
                    // close the sale
                    await awaitTx(d.controller.closeSale())
                    expect(await finalPreSale.state()).to.be.eq(FundraisingState.Closed)
                })

                it("should accumulate two successfull PreSale", async () => {
                    let beneficiaryShare = preSaleConfig.goal.mul(preSaleConfig.beneficiaryPCT).div(PPM)
                    expect(await d.multisig.balanceERC20(d.usdToken.address)).to.be.eq(beneficiaryShare.mul(2))
                })

                it("should not allow to close the vesting for ever directly by calling it on tokenManager", async () => {
                    expect(await d.tokenManager.vestingLockedForEver()).to.be.false
                    let { id } = await multisigCall(d.tokenManager.address, 'closeVestingProcess()', encodeParams([], []))
                    expect((await d.multisig.transactions(id)).executed).to.be.false
                })

                it("should not allow anyone to call suspend on marketmaker direclty", async () => {
                    expect(await d.marketMaker.isSuspended()).to.be.false
                    expect(await isEthException(d.marketMaker.connect(d.owner1).suspend(true))).to.be.true
                    expect(await isEthException(d.marketMaker.connect(d.owner2).suspend(true))).to.be.true
                    expect(await isEthException(d.marketMaker.connect(d.intruder).suspend(true))).to.be.true
                    expect(await d.marketMaker.isSuspended()).to.be.false
                })

                it("should let marketMaker openTrading", async () => {
                    expect(await addCollateralToken()).to.be.true
                    expect(await d.marketMaker.isOpen()).to.be.false

                    let controllerPreSale = await ethers.getContractAt("PreSale", await d.controller.preSale())
                    expect(await controllerPreSale.state()).to.be.eq(FundraisingState.Closed)

                    expect(await d.tokenManager.vestingLockedForEver()).to.be.false
                    expect(await openPublicTrading()).to.be.true
                    expect(await d.marketMaker.isOpen()).to.be.true
                })

                it("should close the vesting after calling openPublicTrading and not allow other sales vest anymore", async () => {
                    let finalPreSale = await ethers.getContractAt("PreSale", await d.controller.preSale())
                    expect(await d.tokenManager.vestingLockedForEver()).to.be.true

                    // should not allow users to vest when tokenManager vesting is closed for ever
                    expect((await d.usdToken.allowance(d.investor1Addr, finalPreSale.address)).gte(toEth(150_000))).to.be.true
                    expect(await isEthException(d.controller.connect(d.investor1).contribute(toEth(1000))))
                    expect(await finalPreSale.totalRaised()).to.be.eq(preSaleConfig.goal)
                })

                it("should not allow us to add another extraSale, because VestingProcess is Locked for ever", async () => {
                    // create another extra sale
                    let anotherExtraSale = await deployPreSale(d.controller.address, d.usdToken.address)
                    // we can not add another sale because vesting is locked for ever
                    let res = await multisigCall(d.controller.address, 'setNewSaleAddress(address)', encodeParams(['address'], [anotherExtraSale.address]))
                    expect((await d.multisig.transactions(res.id)).executed).to.be.false
                })
            })
        })

        describe("seedsale process - Towards success on fundraising", async () => {
            it("must create a new process of fundraising", async () => {
                await setup()
                expect(await d.engaToken.totalSupply()).to.be.eq(INITIAL_SHARE_SUPPLY)
                expect(await d.preSale.openDate()).to.be.eq(0)

                // open PreSale gate
                expect(await openSaleNow()).to.be.true

                let goal = preSaleConfig.goal

                // users can contribute
                r = await awaitTx(d.controller.connect(d.investor1).contribute(goal.div(10)))
                vestedIds[1].push(await getLastVestingId(d.investor1Addr))
                expect(((await d.tokenManager.getVesting(await getLastVestingId(d.investor1Addr))).vestingCreator)).to.be.eq(d.preSale.address)
                r = await awaitTx(d.controller.connect(d.investor1).contribute(goal.div(10)))
                vestedIds[1].push(await getLastVestingId(d.investor1Addr))
                expect(((await d.tokenManager.getVesting(await getLastVestingId(d.investor1Addr))).vestingCreator)).to.be.eq(d.preSale.address)
                r = await awaitTx(d.controller.connect(d.investor1).contribute(goal.div(10)))
                vestedIds[1].push(await getLastVestingId(d.investor1Addr))
                expect(((await d.tokenManager.getVesting(await getLastVestingId(d.investor1Addr))).vestingCreator)).to.be.eq(d.preSale.address)

                r = await awaitTx(d.controller.connect(d.investor2).contribute(goal.div(10)))
                vestedIds[2].push(await getLastVestingId(d.investor2Addr))
                expect(((await d.tokenManager.getVesting(await getLastVestingId(d.investor2Addr))).vestingCreator)).to.be.eq(d.preSale.address)
                r = await awaitTx(d.controller.connect(d.investor2).contribute(goal.div(10)))
                vestedIds[2].push(await getLastVestingId(d.investor2Addr))
                expect(((await d.tokenManager.getVesting(await getLastVestingId(d.investor2Addr))).vestingCreator)).to.be.eq(d.preSale.address)

                r = await awaitTx(d.controller.connect(d.investor3).contribute(goal.div(10)))
                vestedIds[3].push(await getLastVestingId(d.investor3Addr))
                expect((await d.tokenManager.getVesting(await getLastVestingId(d.investor3Addr))).vestingCreator).to.be.eq(d.preSale.address)
            })

            it("should return the extra paid token to the user if goal has reached", async () => {
                let balance = await d.usdToken.balanceOf(d.investor4Addr)
                let remainingToFullfil = preSaleConfig.goal.sub(await d.preSale.totalRaised())

                let extraPaid = toEth(5_000)
                let paid = remainingToFullfil.add(extraPaid)

                await d.controller.connect(d.investor4).contribute(paid) // 5,000 must be returned
                expect(await d.usdToken.balanceOf(d.investor4Addr)).to.be.eq(balance.sub(paid).add(extraPaid))
            })

            it("should change to goal reached state after the goal has been reached", async () => {
                expect(await d.preSale.state()).to.be.eq(FundraisingState.GoalReached)
            })

            it("should change to close after calling close() and distribute conribution tokens to the beneficiary and reserve", async () => {
                let reserveBalance = await d.reserve.balanceERC20(d.usdToken.address)
                let beneficiaryBalance = await d.multisig.balanceERC20(d.usdToken.address)

                await awaitTx(d.preSale.connect(d.intruder).close())
                expect(await d.preSale.state()).to.be.eq(FundraisingState.Closed)

                let beneficiaryBalanceAfterClose = await d.multisig.balanceERC20(d.usdToken.address)
                let reserveBalanceAfterClose = await d.reserve.balanceERC20(d.usdToken.address)

                let seedBalance = await d.preSale.totalRaised()
                let fundForBeneficiary = seedBalance.mul(await d.preSale.fundingForBeneficiaryPct()).div(PPM)
                let fundsForReserve = seedBalance.sub(fundForBeneficiary)

                expect(beneficiaryBalanceAfterClose).to.be.eq(beneficiaryBalance.add(fundForBeneficiary))
                expect(reserveBalanceAfterClose).to.be.eq(reserveBalance.add(fundsForReserve))
            })

            it("should check the supply after seedsale", async () => {
                let low = INITIAL_SHARE_SUPPLY.add(PRE_SALE).sub(SUPPLY_FAULT_TOLERANCE)
                let high = INITIAL_SHARE_SUPPLY.add(PRE_SALE).add(SUPPLY_FAULT_TOLERANCE)
                let supply = await d.engaToken.totalSupply()
                expect(supply.gte(low) && supply.lte(high)).to.be.true
            })

            it("should check for the total minted token", async () => {
                expect(await d.engaToken.totalSupply()).to.be.eq(
                    (await d.tokenManager.vestingsTotalAmount()).add(await d.engaToken.balanceOf(d.seedSale.address))
                )
            })

            it("should check the supply after seedsale", async () => {
                let low = INITIAL_SUPPLY.sub(SUPPLY_FAULT_TOLERANCE)
                let high = INITIAL_SUPPLY.add(SUPPLY_FAULT_TOLERANCE)
                let supply = await d.engaToken.totalSupply()
                expect(supply.gte(low) && supply.lte(high)).to.be.true
            })
        })

        describe("MarketMaker and Tap process", async () => {
            it("should not allow any tappering because no tap token has been added", async () => {
                let tapped = await d.tap.getMaximumWithdrawal(d.usdToken.address)
                expect(tapped).to.be.eq(0)

                expect(await isEthException(d.tap.withdraw(d.usdToken.address))).to.be.true
            })

            it("should not allow others to add new tap token", async () => {
                expect(
                    await isEthException(d.tap.connect(d.owner2).addTappedToken(d.usdToken.address, tapTokenConfigTest.rate, tapTokenConfigTest.floor))
                ).to.be.true

                expect(
                    await isEthException(d.tap.connect(d.intruder).addTappedToken(d.usdToken.address, tapTokenConfigTest.rate, tapTokenConfigTest.floor))
                ).to.be.true

                expect(
                    await isEthException(d.tap.connect(d.owner1).addTappedToken(d.usdToken.address, tapTokenConfigTest.rate, tapTokenConfigTest.floor))
                ).to.be.true
            })

            it("should allow owner to add a new market maker collateral and tap token", async () => {
                let collateral = d.usdToken.address

                expect(await addCollateralToken()).to.be.true

                expect((await d.marketMaker.collaterals(collateral)).whitelisted).to.be.true
                expect((await d.marketMaker.collaterals(collateral)).virtualSupply).to.be.eq(mmCollateralConfig.virtualSupply)
                expect((await d.marketMaker.collaterals(collateral)).virtualBalance).to.be.eq(mmCollateralConfig.virtualBalance)
                expect((await d.marketMaker.collaterals(collateral)).reserveRatio).to.be.eq(mmCollateralConfig.reserveRatioPPM)
                expect((await d.marketMaker.collaterals(collateral)).slippage).to.be.eq(mmCollateralConfig.slippagePCT)

                expect(await d.tap.rates(d.usdToken.address)).to.be.eq(tapTokenConfigTest.rate)
                expect(await d.tap.floors(d.usdToken.address)).to.be.eq(tapTokenConfigTest.floor)

                expect(await d.tap.tappedAmounts(d.usdToken.address)).to.be.eq(0)
                expect(await d.tap.lastTappedAmountUpdates(d.usdToken.address)).to.be.eq(await d.tap.getCurrentBatchId())
            })

            it("should tappering be still equal to zero", async () => {
                let tapped = await d.tap.getMaximumWithdrawal(d.usdToken.address)
                expect(tapped).to.be.eq(0)
            })

            it("should let some value equal to tap be withdrawn", async () => {
                let blockCount = await currentBlock()

                await mine(Number(BATCH_BLOCKS))
                expect(await currentBlock()).to.be.eq(blockCount.add(Number(BATCH_BLOCKS)))

                let tapped = await d.tap.getMaximumWithdrawal(d.usdToken.address)
                expect(tapped.gt(0)).to.be.true
                expect(tapped).to.be.eq(tapTokenConfigTest.rate.mul(Number(BATCH_BLOCKS)))
            })

            it("should allow user to withdraw to the beneficiary from reserve", async () => {
                /* NOTE new Transacion includes new minted block number so following is a possibility
                * First: we may add tap at block 119 which results in BATCH-ID 110
                * Second: after mining BATCHED_BLOCKS (in this case 10) block is 129 BATCH-ID which results in BATCH-ID 120
                * Finally: when we call withdraw it includes new block number and generates block number 130 which results in BATCH-ID 130
                * so instead of having 10 consecutive blocks we have 20 consecutive block which results in 20 * rate
                */

                let reserveBalance = await d.reserve.balanceERC20(d.usdToken.address)
                let beneficiaryBalance = await d.multisig.balanceERC20(d.usdToken.address)

                let tapBlockBatch = await d.tap.lastTappedAmountUpdates(d.usdToken.address)
                let futureBlockBatch = (await currentBlock()).add(1)
                futureBlockBatch = futureBlockBatch.div(BATCH_BLOCKS).mul(BATCH_BLOCKS)

                let amountToWithdraw = futureBlockBatch.sub(tapBlockBatch).mul(tapTokenConfigTest.rate)

                expect(await withdrawTap()).to.be.eq(true)

                expect(await d.reserve.balanceERC20(d.usdToken.address)).to.be.eq(reserveBalance.sub(amountToWithdraw))
                expect(await d.multisig.balanceERC20(d.usdToken.address)).to.be.eq(beneficiaryBalance.add(amountToWithdraw))

                expect(await d.tap.lastTappedAmountUpdates(d.usdToken.address)).to.be.eq(await d.tap.getCurrentBatchId())
                expect(await d.tap.getMaximumWithdrawal(d.usdToken.address)).to.be.eq(0)
            })

            it("should not allow to withdraw amount below the floor", async () => {
                let blockCount = await currentBlock()
                // skip the special case
                if (BATCH_BLOCKS.gt(1)) {
                    if ((await currentBlock()).mod(BATCH_BLOCKS).eq(BATCH_BLOCKS.sub(1))) {
                        await mine(1)
                        let amount = await d.tap.getMaximumWithdrawal(d.usdToken.address)
                        if (amount.gte(0)) {
                            expect(await withdrawTap()).to.be.eq(true)
                        }
                    }
                    blockCount = await currentBlock()
                }

                // it ensures that passed blocks incures more tapped token than amount limited by the floor
                let numberOfBlocks = 90 / Number(BATCH_BLOCKS)

                await mine(Number(BATCH_BLOCKS.mul(numberOfBlocks)))
                expect(await currentBlock()).to.be.eq(blockCount.add(Number(BATCH_BLOCKS.mul(numberOfBlocks))))

                await awaitTx(d.controller.updateTappedAmount(d.usdToken.address))
                let resBal = await d.reserve.balanceERC20(d.usdToken.address)
                let benBal = await d.multisig.balanceERC20(d.usdToken.address)
                let tapped = await d.tap.getMaximumWithdrawal(d.usdToken.address)

                expect(tapped).to.be.eq(resBal.sub(await d.tap.floors(d.usdToken.address)))

                expect(await withdrawTap()).to.be.eq(true)

                expect(await d.reserve.balanceERC20(d.usdToken.address)).to.be.eq(await d.tap.floors(d.usdToken.address))
                expect(await d.reserve.balanceERC20(d.usdToken.address)).to.be.eq(resBal.sub(tapped))
                expect(await d.multisig.balanceERC20(d.usdToken.address)).to.be.eq(benBal.add(tapped))
            })

            it("should not let anybody call withdraw on tap", async () => {
                expect(await isEthException(d.tap.connect(d.intruder).withdraw(d.usdToken.address))).to.be.true
                expect(await isEthException(d.tap.connect(d.owner2).withdraw(d.usdToken.address))).to.be.true
                expect(await isEthException(d.tap.connect(d.owner1).withdraw(d.usdToken.address))).to.be.true

                let { id } = await multisigCall(d.tap.address, 'withdraw(address)', encodeParams(['address'], [d.usdToken.address]))
                expect((await d.multisig.transactions(id)).executed).to.be.false
            })

            it("should not allow anyone to call update beneficiary on tap", async () => {
                expect(await isEthException(d.tap.connect(d.intruder).updateBeneficiary(d.stakeHolders.address))).to.be.true
                expect(await isEthException(d.tap.connect(d.owner2).updateBeneficiary(d.stakeHolders.address))).to.be.true
                expect(await isEthException(d.tap.connect(d.owner1).updateBeneficiary(d.stakeHolders.address))).to.be.true
                expect(await isEthException(d.tap.connect(d.investor1).updateBeneficiary(d.stakeHolders.address))).to.be.true

                let { id } = await multisigCall(d.tap.address, 'updateBeneficiary(address)', encodeParams(['address'], [d.stakeHolders.address]))
                expect((await d.multisig.transactions(id)).executed).to.be.false
            })

            it("should not allow anyone to call update rate pct on tap", async () => {
                let newRatePct = tapConfig.maximumTapRateIncreasePct.add(toEth(0.1)) // increased 10%
                expect(await isEthException(d.tap.connect(d.intruder).updateMaximumTapRateIncreasePct(newRatePct))).to.be.true
                expect(await isEthException(d.tap.connect(d.owner2).updateMaximumTapRateIncreasePct(newRatePct))).to.be.true
                expect(await isEthException(d.tap.connect(d.owner1).updateMaximumTapRateIncreasePct(newRatePct))).to.be.true
                expect(await isEthException(d.tap.connect(d.investor1).updateMaximumTapRateIncreasePct(newRatePct))).to.be.true

                let { id } = await multisigCall(d.tap.address, 'updateMaximumTapRateIncreasePct(uint256)', encodeParams(['uint256'], [newRatePct]))
                expect((await d.multisig.transactions(id)).executed).to.be.false
            })

            it("should not allow anyone to call update floor pct on tap", async () => {
                let newFloorPct = tapConfig.maximumTapFloorDecreasePct.sub(toEth(0.1)) // decreased 10%
                expect(await isEthException(d.tap.connect(d.intruder).updateMaximumTapFloorDecreasePct(newFloorPct))).to.be.true
                expect(await isEthException(d.tap.connect(d.owner2).updateMaximumTapFloorDecreasePct(newFloorPct))).to.be.true
                expect(await isEthException(d.tap.connect(d.owner1).updateMaximumTapFloorDecreasePct(newFloorPct))).to.be.true
                expect(await isEthException(d.tap.connect(d.investor1).updateMaximumTapFloorDecreasePct(newFloorPct))).to.be.true

                let { id } = await multisigCall(d.tap.address, 'updateMaximumTapFloorDecreasePct(uint256)', encodeParams(['uint256'], [newFloorPct]))
                expect((await d.multisig.transactions(id)).executed).to.be.false
            })

            it("should not allow anyone to call remove tap on tap", async () => {
                expect(await isEthException(d.tap.connect(d.intruder).removeTappedToken(d.usdToken.address))).to.be.true
                expect(await isEthException(d.tap.connect(d.owner2).removeTappedToken(d.usdToken.address))).to.be.true
                expect(await isEthException(d.tap.connect(d.owner1).removeTappedToken(d.usdToken.address))).to.be.true
                expect(await isEthException(d.tap.connect(d.investor1).removeTappedToken(d.usdToken.address))).to.be.true

                let { id } = await multisigCall(d.tap.address, 'removeTappedToken(address)', encodeParams(['address'], [d.usdToken.address]))
                expect((await d.multisig.transactions(id)).executed).to.be.false
            })

            it("should not allow anyone to call reset tap on tap", async () => {
                expect(await isEthException(d.tap.connect(d.intruder).resetTappedToken(d.usdToken.address))).to.be.true
                expect(await isEthException(d.tap.connect(d.owner2).resetTappedToken(d.usdToken.address))).to.be.true
                expect(await isEthException(d.tap.connect(d.owner1).resetTappedToken(d.usdToken.address))).to.be.true
                expect(await isEthException(d.tap.connect(d.investor1).resetTappedToken(d.usdToken.address))).to.be.true

                let { id } = await multisigCall(d.tap.address, 'resetTappedToken(address)', encodeParams(['address'], [d.usdToken.address]))
                expect((await d.multisig.transactions(id)).executed).to.be.false
            })

            it("should not allow anyone to call update tap", async () => {
                let newRate = tapTokenConfigTest.rate.add(1_500)
                let newFloor = tapTokenConfigTest.floor.sub(20_000)

                expect(await isEthException(d.tap.connect(d.intruder).updateTappedToken(d.usdToken.address, newRate, newFloor))).to.be.true
                expect(await isEthException(d.tap.connect(d.owner1).updateTappedToken(d.usdToken.address, newRate, newFloor))).to.be.true
                expect(await isEthException(d.tap.connect(d.investor1).updateTappedToken(d.usdToken.address, newRate, newFloor))).to.be.true

                let { id } = await multisigCall(d.tap.address, 'updateTappedToken(address,uint256,uint256)', encodeParams(['address', 'uint256', 'uint256'], [d.usdToken.address, newRate, newFloor]))
                expect((await d.multisig.transactions(id)).executed).to.be.false
            })

            it("should not allow multisig update token rate with valid increase in relation with maximumTapRateIncrease because 30 days has not passed yet", async () => {
                let newRate = tapTokenConfigTest.rate.add(toEth(500)) // Valid
                let target = d.controller.address
                let sig = 'updateTappedToken(address,uint256,uint256)'
                let calldata = encodeParams(['address', 'uint256', 'uint256'], [d.usdToken.address, newRate, tapTokenConfigTest.floor])

                let { id, r } = await multisigCall(target, sig, calldata)

                expect((await d.multisig.transactions(id)).executed).to.be.false // executed == false

                let func = () => d.controller.interface.decodeFunctionResult("updateTappedToken", execEventArgs(r).returndata)
                expect(isThrownError(func)).to.be.true
            })

            it("should check the date if it has passed 30 days or not", async () => {
                let time = await getCurrentNetworkTime()
                await waitFor(31 * days)
                expect((await d.tap.lastTapUpdates(d.usdToken.address)).lte(time + 31 * days)).to.be.true
            })

            it("should not allow multisig update token rate with valid increase in relation with maximumTapRateIncreasePct because update rate is invalid", async () => {
                let newRate = toEth(2_001) // Invalid , 2001 ! <= 1000 + (1000 * 100%)
                let target = d.controller.address
                let sig = 'updateTappedToken(address,uint256,uint256)'
                let calldata = encodeParams(['address', 'uint256', 'uint256'], [d.usdToken.address, newRate, tapTokenConfigTest.floor])

                let { id, r } = await multisigCall(target, sig, calldata)
                expect((await d.multisig.transactions(id)).executed).to.be.false // executed == false

                let func = () => d.controller.interface.decodeFunctionResult("updateTappedToken", execEventArgs(r).returndata)
                expect(isThrownError(func)).to.be.true
            })

            it("should not allow multisig update token floor rate with valid increase in relation with maximumTapFloorDecreasePct because update rate is invalid", async () => {
                let newFloor = toEth(2_000)
                let target = d.controller.address
                let sig = 'updateTappedToken(address,uint256,uint256)'
                let calldata = encodeParams(['address', 'uint256', 'uint256'], [d.usdToken.address, tapTokenConfigTest.rate, newFloor])

                let { id, r } = await multisigCall(target, sig, calldata)

                expect((await d.multisig.transactions(id)).executed).to.be.false // executed == false

                let func = () => d.controller.interface.decodeFunctionResult("updateTappedToken", execEventArgs(r).returndata)
                expect(isThrownError(func)).to.be.true
            })

            it("should allow multisig update token rate with valid increase in relation with maximumTapRateIncrease because update rate is invalid", async () => {
                let newFloor = toEth(18_000)
                let newRate = toEth(2_000)
                let target = d.controller.address
                let sig = 'updateTappedToken(address,uint256,uint256)'
                let calldata = encodeParams(['address', 'uint256', 'uint256'], [d.usdToken.address, newRate, newFloor])

                let time = await getCurrentNetworkTime()

                let { id, r } = await multisigCall(target, sig, calldata)

                expect((await d.multisig.transactions(id)).executed).to.be.true // executed == true

                expect(await d.tap.floors(d.usdToken.address)).to.be.eq(newFloor)
                expect(await d.tap.rates(d.usdToken.address)).to.be.eq(newRate)
                expect((await d.tap.lastTapUpdates(d.usdToken.address)).gte(time)).to.be.true

                let func = () => d.controller.interface.decodeFunctionResult("updateTappedToken", execEventArgs(r).returndata)
                expect(isThrownError(func)).to.be.false
            })

            it("should allow multisig to call update rate pct", async () => {
                let newRatePct = tapConfig.maximumTapRateIncreasePct.add(toEth(0.1)) // increased 10%
                let target = d.controller.address
                let sig = 'updateMaximumTapRateIncreasePct(uint256)'
                let calldata = encodeParams(['uint256'], [newRatePct])

                let { id, r } = await multisigCall(target, sig, calldata)

                expect((await d.multisig.transactions(id)).executed).to.be.true // executed == true

                expect(await d.tap.maximumTapRateIncreasePct()).to.be.eq(newRatePct)

                let func = () => d.controller.interface.decodeFunctionResult("updateMaximumTapRateIncreasePct", execEventArgs(r).returndata)
                expect(isThrownError(func)).to.be.false
            })

            it("should not allow maximumTapFloorDecreasePct goes higher than PCT ( > 1e18)", async () => {
                let newFloorPct = tapConfig.maximumTapFloorDecreasePct.add(toEth(1)) // increased 100%
                let target = d.controller.address
                let sig = 'updateMaximumTapFloorDecreasePct(uint256)'
                let calldata = encodeParams(['uint256'], [newFloorPct])

                let { id, r } = await multisigCall(target, sig, calldata)

                expect((await d.multisig.transactions(id)).executed).to.be.false // executed == false

                let func = () => d.controller.interface.decodeFunctionResult("updateMaximumTapFloorDecreasePct", execEventArgs(r).returndata)
                expect(isThrownError(func)).to.be.true
            })

            it("should allow multisig to call update floor pct", async () => {
                let newFloorPct = tapConfig.maximumTapFloorDecreasePct.sub(toEth(0.1)) // decreased 10%
                let target = d.controller.address
                let sig = 'updateMaximumTapFloorDecreasePct(uint256)'
                let calldata = encodeParams(['uint256'], [newFloorPct])

                let { id, r } = await multisigCall(target, sig, calldata)

                expect((await d.multisig.transactions(id)).executed).to.be.true // executed == true

                expect(await d.tap.maximumTapFloorDecreasePct()).to.be.eq(newFloorPct)

                let func = () => d.controller.interface.decodeFunctionResult("updateMaximumTapFloorDecreasePct", execEventArgs(r).returndata)
                expect(isThrownError(func)).to.be.false
            })

            it("should not allow multisig to call reset tap", async () => {
                let target = d.tap.address
                let sig = 'resetTappedToken(address)'
                let calldata = encodeParams(['address'], [d.usdToken.address])

                let time = await getCurrentNetworkTime()
                let { id, r } = await multisigCall(target, sig, calldata)

                expect((await d.multisig.transactions(id)).executed).to.be.false // executed == true

                let func = () => d.tap.interface.decodeFunctionResult("resetTappedToken", execEventArgs(r).returndata)
                expect(isThrownError(func)).to.be.true
            })

            it("should not allow multisig to call remove tap because marketmaker collateral exists that could make problems", async () => {
                let target = d.controller.address
                let sig = 'removeTappedToken(address)'
                let calldata = encodeParams(['address'], [d.usdToken.address])

                let { id, r } = await multisigCall(target, sig, calldata)

                expect((await d.multisig.transactions(id)).executed).to.be.false // executed == true

                let func = () => d.controller.interface.decodeFunctionResult("removeTappedToken", execEventArgs(r).returndata)
                expect(isThrownError(func)).to.be.true
            })

            it("should first remove the collateral of marketmaker before removing tap collateral", async () => {
                let target = d.controller.address
                let sig = 'removeCollateralToken(address)'
                let calldata = encodeParams(['address'], [d.usdToken.address])

                expect((await d.marketMaker.collaterals(d.usdToken.address)).whitelisted).to.be.true

                let { id, r } = await multisigCall(target, sig, calldata)
                expect((await d.multisig.transactions(id)).executed).to.be.true // executed == true

                expect((await d.marketMaker.collaterals(d.usdToken.address)).whitelisted).to.be.false
            })

            it("should allow multisig to call remove tap after marketmaker collateral is removed", async () => {
                let target = d.controller.address
                let sig = 'removeTappedToken(address)'
                let calldata = encodeParams(['address'], [d.usdToken.address])

                let { id, r } = await multisigCall(target, sig, calldata)

                expect((await d.multisig.transactions(id)).executed).to.be.true // executed == true

                let func = () => d.controller.interface.decodeFunctionResult("removeTappedToken", execEventArgs(r).returndata)
                expect(isThrownError(func)).to.be.false

                expect(await d.tap.floors(d.usdToken.address)).to.be.eq(0)
                expect(await d.tap.rates(d.usdToken.address)).to.be.eq(0)
            })

            it("should allow controller to grantRole", async () => {
                let contract = d.reserve.address
                let role = TRANSFER_ROLE
                let to = d.owner2Addr

                let target = d.controller.address
                let sig = 'grantRoleTo(address,bytes32,address)'
                let calldata = encodeParams(['address', 'bytes32', 'address'], [contract, role, to])

                expect(await d.reserve.hasRole(TRANSFER_ROLE, to)).to.be.false
                let res = await multisigCall(target, sig, calldata)
                expect((await d.multisig.transactions(res.id)).executed).to.be.true
                expect(await d.reserve.hasRole(TRANSFER_ROLE, to)).to.be.true
            })

            it("should allow controller to revokeRole", async () => {
                let contract = d.reserve.address
                let role = TRANSFER_ROLE
                let from = d.owner2Addr

                let target = d.controller.address
                let sig = 'revokeRoleFrom(address,bytes32,address)'
                let calldata = encodeParams(['address', 'bytes32', 'address'], [contract, role, from])

                expect(await d.reserve.hasRole(TRANSFER_ROLE, from)).to.be.true
                let res = await multisigCall(target, sig, calldata)
                expect((await d.multisig.transactions(res.id)).executed).to.be.true
                expect(await d.reserve.hasRole(TRANSFER_ROLE, from)).to.be.false
            })
        })

        describe("MarketMaker initialization process", async () => {
            it("should not let anybody else other than controller or prime sender open the gate", async () => {
                expect(await isEthException(d.marketMaker.connect(d.intruder).open())).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.owner2).open())).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.owner1).open())).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.investor1).open())).to.be.true

                let { id } = await multisigCall(d.marketMaker.address, 'open()', encodeParams([], []));
                expect((await d.multisig.transactions(id)).executed).to.be.false
            })

            it("should not allow other than controller to call updateBancorFormula even not the prime sender", async () => {
                let newBancor = d.bancor.address
                expect(await isEthException(d.marketMaker.connect(d.owner2).updateBancorFormula(newBancor))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.intruder).updateBancorFormula(newBancor))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.owner1).updateBancorFormula(newBancor))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.investor1).updateBancorFormula(newBancor))).to.be.true

                let { id } = await multisigCall(d.marketMaker.address, 'updateBancorFormula(address)', encodeParams(['address'], [newBancor]));
                expect((await d.multisig.transactions(id)).executed).to.be.false
            })

            it("should not allow other than controller to call updateTreasury even not the prime sender", async () => {
                let newTreasury = d.treasury.address
                expect(await isEthException(d.marketMaker.connect(d.owner2).updateTreasury(newTreasury))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.intruder).updateTreasury(newTreasury))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.owner1).updateTreasury(newTreasury))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.investor1).updateTreasury(newTreasury))).to.be.true

                let { id } = await multisigCall(d.marketMaker.address, 'updateTreasury(address)', encodeParams(['address'], [newTreasury]));
                expect((await d.multisig.transactions(id)).executed).to.be.false
            })

            it("should not allow other than controller to call updateFees even not the prime sender", async () => {
                let buyPct = marketMakerConfig.buyFeePct
                let sellPct = marketMakerConfig.sellFeePct
                expect(await isEthException(d.marketMaker.connect(d.owner2).updateFees(buyPct, sellPct))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.intruder).updateFees(buyPct, sellPct))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.owner1).updateFees(buyPct, sellPct))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.investor1).updateFees(buyPct, sellPct))).to.be.true

                let { id } = await multisigCall(d.marketMaker.address, 'updateFees(uint256,uint256)', encodeParams(['uint256', 'uint256'], [buyPct, sellPct]));
                expect((await d.multisig.transactions(id)).executed).to.be.false
            })

            it("should not allow other than controller or prime sender to call addCollateralToken", async () => {
                let collateral = d.usdToken.address
                let virtualSupply = mmCollateralConfig.virtualSupply
                let virtualBalance = mmCollateralConfig.virtualBalance
                let reserveRatio = mmCollateralConfig.reserveRatioPPM
                let slippage = mmCollateralConfig.slippagePCT
                expect(await isEthException(d.marketMaker.connect(d.intruder).addCollateralToken(collateral, virtualSupply, virtualBalance, reserveRatio, slippage))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.owner1).addCollateralToken(collateral, virtualSupply, virtualBalance, reserveRatio, slippage))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.investor1).addCollateralToken(collateral, virtualSupply, virtualBalance, reserveRatio, slippage))).to.be.true

                let { id } = await multisigCall(d.marketMaker.address, 'addCollateralToken(address,uint256,uint256,uint32,uint256)', encodeParams(['address', 'uint256', 'uint256', 'uint32', 'uint256'], [collateral, virtualSupply, virtualBalance, reserveRatio, slippage]));
                expect((await d.multisig.transactions(id)).executed).to.be.false
            })

            it("should not allow other than controller to call removeCollateralToken", async () => {
                let collateral = d.usdToken.address
                expect(await isEthException(d.marketMaker.connect(d.owner2).removeCollateralToken(collateral))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.intruder).removeCollateralToken(collateral))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.owner1).removeCollateralToken(collateral))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.investor1).removeCollateralToken(collateral))).to.be.true

                let { id } = await multisigCall(d.marketMaker.address, 'removeCollateralToken(address)', encodeParams(['address'], [collateral]));
                expect((await d.multisig.transactions(id)).executed).to.be.false
            })

            it("should not allow other than multisig to controller updateCollateralToken", async () => {
                let collateral = d.usdToken.address
                let virtualSupply = mmCollateralConfig.virtualSupply
                let virtualBalance = mmCollateralConfig.virtualBalance
                let reserveRatio = mmCollateralConfig.reserveRatioPPM
                let slippage = mmCollateralConfig.slippagePCT
                expect(await isEthException(d.marketMaker.connect(d.intruder).updateCollateralToken(collateral, virtualSupply, virtualBalance, reserveRatio, slippage))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.owner1).updateCollateralToken(collateral, virtualSupply, virtualBalance, reserveRatio, slippage))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.investor1).updateCollateralToken(collateral, virtualSupply, virtualBalance, reserveRatio, slippage))).to.be.true

                let { id } = await multisigCall(d.marketMaker.address, 'updateCollateralToken(address,uint256,uint256,uint32,uint256)', encodeParams(['address', 'uint256', 'uint256', 'uint32', 'uint256'], [collateral, virtualSupply, virtualBalance, reserveRatio, slippage]));
                expect((await d.multisig.transactions(id)).executed).to.be.false
            })

            it("should not allow investors to call openBuyOrder before opening the market maker", async () => {
                let collateral = d.usdToken.address
                let value = toEth(10_000)
                expect(await isEthException(d.marketMaker.connect(d.owner2).openBuyOrder(d.investor1Addr, collateral, value))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.owner1).openBuyOrder(d.investor1Addr, collateral, value))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.investor1).openBuyOrder(d.investor1Addr, collateral, value))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.investor2).openBuyOrder(d.investor2Addr, collateral, value))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.investor3).openBuyOrder(d.investor3Addr, collateral, value))).to.be.true

                let { id } = await multisigCall(d.marketMaker.address, 'openBuyOrder(address,address,uint256)', encodeParams(['address', 'address', 'uint256'], [d.investor1Addr, collateral, value]));
                expect((await d.multisig.transactions(id)).executed).to.be.false
            })

            it("should not allow investors to call openSellOrder before opening the market maker", async () => {
                let collateral = d.usdToken.address
                let amount = toEth(1_000)
                expect(await isEthException(d.marketMaker.connect(d.owner2).openSellOrder(d.investor1Addr, collateral, amount))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.owner1).openSellOrder(d.investor1Addr, collateral, amount))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.investor1).openSellOrder(d.investor1Addr, collateral, amount))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.investor2).openSellOrder(d.investor2Addr, collateral, amount))).to.be.true
                expect(await isEthException(d.marketMaker.connect(d.investor3).openSellOrder(d.investor3Addr, collateral, amount))).to.be.true

                let { id } = await multisigCall(d.marketMaker.address, 'openSellOrder(address,address,uint256)', encodeParams(['address', 'address', 'uint256'], [d.investor1Addr, collateral, amount]));
                expect((await d.multisig.transactions(id)).executed).to.be.false
            })

            it("should not let multisig or prime sender open the gate, and not let controller to open it if tap is not tapped yet", async () => {
                expect(await d.marketMaker.isOpen()).to.be.false
                expect(await isEthException(d.controller.connect(d.owner4).openPublicTrading([d.usdToken.address]))).to.be.true
                expect(await isEthException(d.controller.openPublicTrading([d.usdToken.address]))).to.be.true
            })

            it("should let controller open the gate after adding collaterals and tapped token", async () => {
                expect(await addCollateralToken()).to.be.true
                expect(await d.marketMaker.isOpen()).to.be.false
                expect(await isEthException(d.controller.connect(d.owner4).openPublicTrading([d.usdToken.address]))).to.be.true
                expect(await isEthException(d.controller.connect(d.owner3).openPublicTrading([d.usdToken.address]))).to.be.true
                expect(await isEthException(d.controller.connect(d.owner1).openPublicTrading([d.usdToken.address]))).to.be.true
                expect(await isEthException(d.controller.connect(d.owner2).openPublicTrading([d.usdToken.address]))).to.be.true
                expect(await openPublicTrading()).to.be.true
                expect(await d.marketMaker.isOpen()).to.be.true
            })

            it("should reserve at initial state for 0.25 price per token", async () => {
                let collateralToBeAdded = calculateInitialReserveBalance().sub(await d.reserve.balanceERC20(d.usdToken.address))
                if (collateralToBeAdded.gt(0)) {
                    await awaitTx(d.usdToken.approveInternal(d.investor1Addr, d.reserve.address, collateralToBeAdded))
                    await awaitTx(d.reserve.connect(d.investor1).depositERC20(d.usdToken.address, collateralToBeAdded))
                }

                expect(await d.reserve.balanceERC20(d.usdToken.address)).to.be.eq(calculateInitialReserveBalance())

                expect(await dynamicPricePPM()).to.be.eq(PUBLIC_SALE_PRICE_PPM)
                expect(await dynamicPricePPM()).to.be.eq(await d.marketMaker.getDynamicPricePPM(d.usdToken.address))
            })

            it("should allow only controller to call updateBancorFormula ", async () => {
                let newBancor = d.bancor.address

                let target = d.controller.address
                let sig = 'updateBancorFormula(address)'
                let calldata = encodeParams(['address'], [newBancor])

                let { id, r } = await multisigCall(target, sig, calldata)
                expect(((await d.multisig.transactions(id)).executed)).to.be.true
            })

            it("should allow only multisig to call updateTreasury", async () => {
                let newTreasury = d.treasury.address

                let target = d.controller.address
                let sig = 'updateTreasury(address)'
                let calldata = encodeParams(['address'], [newTreasury])

                let { id, r } = await multisigCall(target, sig, calldata)
                expect(((await d.multisig.transactions(id)).executed)).to.be.true
            })

            it("should allow only controller to call updateFees", async () => {
                let buyPct = marketMakerConfig.buyFeePct
                let sellPct = marketMakerConfig.sellFeePct

                let target = d.controller.address
                let sig = 'updateFees(uint256,uint256)'
                let calldata = encodeParams(['uint256', 'uint256'], [buyPct, sellPct])

                let { id, r } = await multisigCall(target, sig, calldata)
                expect(((await d.multisig.transactions(id)).executed)).to.be.true
            })

            it("should allow only controller to call removeCollateralToken", async () => {
                let collateral = d.usdToken.address

                let target = d.controller.address
                let sig = 'removeCollateralToken(address)'
                let calldata = encodeParams(['address'], [collateral])

                expect((await d.marketMaker.collaterals(collateral)).whitelisted).to.be.true

                let { id, r } = await multisigCall(target, sig, calldata)
                expect(((await d.multisig.transactions(id)).executed)).to.be.true

                expect((await d.marketMaker.collaterals(collateral)).whitelisted).to.be.false
                expect((await d.marketMaker.collaterals(collateral)).virtualSupply).to.be.eq(0)
                expect((await d.marketMaker.collaterals(collateral)).virtualBalance).to.be.eq(0)
                expect((await d.marketMaker.collaterals(collateral)).reserveRatio).to.be.eq(0)
                expect((await d.marketMaker.collaterals(collateral)).slippage).to.be.eq(0)
            })

            it("should allow controller call reAddCollateralToken for a former added collateral, this will not set tap anymore", async () => {
                let collateral = d.usdToken.address
                let virtualSupply = mmCollateralConfig.virtualSupply
                let virtualBalance = mmCollateralConfig.virtualBalance
                let reserveRatio = mmCollateralConfig.reserveRatioPPM
                let slippage = mmCollateralConfig.slippagePCT

                let target = d.controller.address
                let sig = 'reAddCollateralToken(address,uint256,uint256,uint32,uint256)'
                let calldata = encodeParams(['address', 'uint256', 'uint256', 'uint32', 'uint256'], [collateral, virtualSupply, virtualBalance, reserveRatio, slippage])

                expect((await d.marketMaker.collaterals(d.usdToken.address)).whitelisted).to.be.false

                let { id, r } = await multisigCall(target, sig, calldata)
                expect(((await d.multisig.transactions(id)).executed)).to.be.true

                expect((await d.marketMaker.collaterals(d.usdToken.address)).whitelisted).to.be.true

                expect((await d.marketMaker.collaterals(d.usdToken.address)).virtualSupply).to.be.eq(virtualSupply)
                expect((await d.marketMaker.collaterals(d.usdToken.address)).virtualBalance).to.be.eq(virtualBalance)
                expect((await d.marketMaker.collaterals(d.usdToken.address)).reserveRatio).to.be.eq(reserveRatio)
                expect((await d.marketMaker.collaterals(d.usdToken.address)).slippage).to.be.eq(slippage)
            })

            it("should allow only controller to call updateCollateralToken", async () => {
                let collateral = d.usdToken.address
                let virtualSupply = toEth(2000)
                let virtualBalance = toEth(10)
                let reserveRatio = 77777
                let slippage = toEth(0.1)

                let target = d.controller.address
                let sig = 'updateCollateralToken(address,uint256,uint256,uint32,uint256)'
                let calldata = encodeParams(['address', 'uint256', 'uint256', 'uint32', 'uint256'], [collateral, virtualSupply, virtualBalance, reserveRatio, slippage])

                expect((await d.marketMaker.collaterals(d.usdToken.address)).whitelisted).to.be.true

                let { id, r } = await multisigCall(target, sig, calldata)
                expect(((await d.multisig.transactions(id)).executed)).to.be.true

                expect((await d.marketMaker.collaterals(d.usdToken.address)).whitelisted).to.be.true

                expect((await d.marketMaker.collaterals(d.usdToken.address)).virtualSupply).to.be.eq(virtualSupply)
                expect((await d.marketMaker.collaterals(d.usdToken.address)).virtualBalance).to.be.eq(virtualBalance)
                expect((await d.marketMaker.collaterals(d.usdToken.address)).reserveRatio).to.be.eq(reserveRatio)
                expect((await d.marketMaker.collaterals(d.usdToken.address)).slippage).to.be.eq(slippage)
            })

            it("should allow only controller to call updateCollateralToken", async () => {
                let collateral = d.usdToken.address
                let virtualSupply = mmCollateralConfig.virtualSupply
                let virtualBalance = mmCollateralConfig.virtualBalance
                let reserveRatio = mmCollateralConfig.reserveRatioPPM
                let slippage = mmCollateralConfig.slippagePCT

                let target = d.controller.address
                let sig = 'updateCollateralToken(address,uint256,uint256,uint32,uint256)'
                let calldata = encodeParams(['address', 'uint256', 'uint256', 'uint32', 'uint256'], [collateral, virtualSupply, virtualBalance, reserveRatio, slippage])

                expect((await d.marketMaker.collaterals(d.usdToken.address)).whitelisted).to.be.true

                let { id, r } = await multisigCall(target, sig, calldata)
                expect(((await d.multisig.transactions(id)).executed)).to.be.true

                expect((await d.marketMaker.collaterals(d.usdToken.address)).whitelisted).to.be.true

                expect((await d.marketMaker.collaterals(d.usdToken.address)).virtualSupply).to.be.eq(virtualSupply)
                expect((await d.marketMaker.collaterals(d.usdToken.address)).virtualBalance).to.be.eq(virtualBalance)
                expect((await d.marketMaker.collaterals(d.usdToken.address)).reserveRatio).to.be.eq(reserveRatio)
                expect((await d.marketMaker.collaterals(d.usdToken.address)).slippage).to.be.eq(slippage)
            })
        })

        describe("MarketMaker buy/sell process", async () => {
            it("should allow one investor to buy token with bancor formula", async () => {
                await mineToNewBatchId()

                let collateral = d.usdToken.address
                let valueToBuy = toEth(10_000)

                let feeAfterBuy = valueToBuy.mul(marketMakerConfig.buyFeePct).div(PCT)
                let valueAfterBuy = valueToBuy.sub(feeAfterBuy)

                let reserveBalance = await d.reserve.balanceERC20(collateral)
                await awaitTx(d.controller.updateTappedAmount(collateral))
                let tappedReserveBalance = reserveBalance.sub(await d.tap.getMaximumWithdrawal(collateral))
                let treasuryBal = await d.treasury.balanceERC20(collateral)

                let beforeSupply = (await d.engaToken.totalSupply()).add(await d.marketMaker.tokensToBeMinted())
                let beforeTotalSupply = beforeSupply.add(mmCollateralConfig.virtualSupply)
                let beforeBalance = tappedReserveBalance.add(mmCollateralConfig.virtualBalance).sub(await d.marketMaker.collateralsToBeClaimed(collateral))

                let beforePricePPM = await dynamicPricePPM()
                expect(beforePricePPM).to.be.eq(await d.marketMaker.getDynamicPricePPM(d.usdToken.address))
                expect(beforePricePPM).to.be.eq(await d.marketMaker.getStaticPricePPM(beforeTotalSupply, beforeBalance, mmCollateralConfig.reserveRatioPPM))

                r = await awaitTx(d.controller.connect(d.investor1).openBuyOrder(collateral, valueToBuy))
                let afterPricePPM = await dynamicPricePPM()

                let tokensToBeMinted = await d.marketMaker.tokensToBeMinted()
                let boughtToken = await d.bancor.calculatePurchaseReturn(beforeTotalSupply, beforeBalance, mmCollateralConfig.reserveRatioPPM, valueAfterBuy)

                expect(tokensToBeMinted).to.be.eq(boughtToken)

                expect(afterPricePPM).to.be.eq(await d.marketMaker.getDynamicPricePPM(d.usdToken.address))

                let batchId = await d.marketMaker.getCurrentBatchId()

                expect(await d.reserve.balanceERC20(collateral)).to.be.eq(reserveBalance.add(valueAfterBuy))
                expect(await d.treasury.balanceERC20(collateral)).to.be.eq(treasuryBal.add(feeAfterBuy))

                expect(afterPricePPM.gt(beforePricePPM)).to.be.true

                expect(await isEthException(
                    d.controller.connect(d.investor1).claimBuyOrder(d.investor1Addr, batchId, collateral))
                ).to.be.true

                await mineToNewBatchId()

                let beforeClaimTokenBalance = await d.engaToken.balanceOf(d.investor1Addr)

                r = await awaitTx(d.marketMaker.connect(d.investor1).claimBuyOrder(d.investor1Addr, batchId, collateral))

                expect(await d.marketMaker.tokensToBeMinted()).to.be.eq(tokensToBeMinted.sub(boughtToken))
                expect(await d.engaToken.balanceOf(d.investor1Addr)).to.be.eq(beforeClaimTokenBalance.add(boughtToken))
            })

            it("should allow one investor to sell token with bancor formula", async () => {
                let collateral = d.usdToken.address
                let amountToSell = (await d.engaToken.balanceOf(d.investor1Addr)).div(2)
                let engaBalanceOfUser = await d.engaToken.balanceOf(d.investor1Addr)

                let reserveBalance = await d.reserve.balanceERC20(collateral)
                await awaitTx(d.controller.updateTappedAmount(collateral))

                let tappedReserveBalance = reserveBalance.sub(await d.tap.getMaximumWithdrawal(collateral))
                let treasuryBal = await d.treasury.balanceERC20(collateral)

                let beforeSupply = (await d.engaToken.totalSupply()).add(await d.marketMaker.tokensToBeMinted())
                let beforeTotalSupply = beforeSupply.add(mmCollateralConfig.virtualSupply)
                let beforeBalance = tappedReserveBalance.add(mmCollateralConfig.virtualBalance).sub(await d.marketMaker.collateralsToBeClaimed(collateral))

                r = await awaitTx(d.controller.connect(d.investor1).openSellOrder(collateral, amountToSell))
                let collatrelasToReceive = await d.bancor.calculateSaleReturn(beforeTotalSupply, beforeBalance, mmCollateralConfig.reserveRatioPPM, amountToSell)
                let collateralsToBeClaimed = await d.marketMaker.collateralsToBeClaimed(collateral)

                expect(collatrelasToReceive).to.be.eq(collateralsToBeClaimed)

                let batchId = await d.marketMaker.getCurrentBatchId()

                let supply = (await d.engaToken.totalSupply()).add(await d.marketMaker.tokensToBeMinted())
                expect(supply).to.be.eq(beforeSupply.sub(amountToSell))

                expect(
                    collatrelasToReceive
                ).to.be.eq(await d.marketMaker.collateralsToBeClaimed(collateral))

                expect(await isEthException(
                    d.marketMaker.connect(d.investor1).claimSellOrder(d.investor1Addr, batchId, collateral))
                ).to.be.true

                let afterPricePPM = await dynamicPricePPM()
                let newSupply = beforeTotalSupply.sub(amountToSell)
                let newBalance = beforeBalance.sub(collatrelasToReceive)
                let newPricePPM = await d.marketMaker.getStaticPricePPM(newSupply, newBalance, mmCollateralConfig.reserveRatioPPM)
                expect(newPricePPM).to.be.eq(afterPricePPM)

                await mineToNewBatchId()

                let userCollateral = await d.usdToken.balanceOf(d.investor1Addr)
                let feeAfterSell = collatrelasToReceive.mul(marketMakerConfig.sellFeePct).div(PCT)
                let valueAfterSell = collatrelasToReceive.sub(feeAfterSell)

                r = await awaitTx(d.marketMaker.connect(d.investor1).claimSellOrder(d.investor1Addr, batchId, collateral))

                expect(await d.reserve.balanceERC20(collateral)).to.be.eq(reserveBalance.sub(collatrelasToReceive))
                expect(await d.treasury.balanceERC20(collateral)).to.be.eq(treasuryBal.add(feeAfterSell))
                expect(await d.usdToken.balanceOf(d.investor1Addr)).to.be.eq(userCollateral.add(valueAfterSell))

                expect(await d.engaToken.balanceOf(d.investor1Addr)).to.be.eq(engaBalanceOfUser.sub(amountToSell))
                expect(await d.marketMaker.collateralsToBeClaimed(collateral)).to.be.eq(collateralsToBeClaimed.sub(collatrelasToReceive))
            })

            it("should batch multiple buy orders and let each of them be claimed", async () => {
                let collateral = d.usdToken.address
                let buyOrders = [toEth(100_000), toEth(100_000), toEth(100_000)]

                let allBuy = buyOrders.reduce((prev, curr, currIndex, arrayIsEqual) => {
                    return prev.add(curr)
                })

                let feeAfterBuy = allBuy.mul(marketMakerConfig.buyFeePct).div(PCT)
                let valueAfterBuy = allBuy.sub(feeAfterBuy)

                await mineToNewBatchId()
                let batchId = await d.marketMaker.getCurrentBatchId()

                let reserveBalance = await d.reserve.balanceERC20(collateral)
                await awaitTx(d.controller.updateTappedAmount(collateral))
                let tappedReserveBalance = reserveBalance.sub(await d.tap.getMaximumWithdrawal(collateral))
                let treasuryBal = await d.treasury.balanceERC20(collateral)

                let beforeSupply = (await d.engaToken.totalSupply()).add(await d.marketMaker.tokensToBeMinted())
                let beforeTotalSupply = beforeSupply.add(mmCollateralConfig.virtualSupply)
                let beforeBalance = tappedReserveBalance.add(mmCollateralConfig.virtualBalance).sub(await d.marketMaker.collateralsToBeClaimed(collateral))


                r = await awaitTx(d.controller.connect(d.investor1).openBuyOrder(collateral, buyOrders[0]))
                r = await awaitTx(d.controller.connect(d.investor2).openBuyOrder(collateral, buyOrders[1]))
                r = await awaitTx(d.controller.connect(d.investor3).openBuyOrder(collateral, buyOrders[2]))

                let boughtToken = await d.bancor.calculatePurchaseReturn(beforeTotalSupply, beforeBalance, mmCollateralConfig.reserveRatioPPM, valueAfterBuy)
                expect(boughtToken).to.be.eq(await d.marketMaker.tokensToBeMinted())

                await mineToNewBatchId()

                await awaitTx(d.controller.claimBuyOrder(d.investor1Addr, batchId, collateral))
                await awaitTx(d.controller.claimBuyOrder(d.investor2Addr, batchId, collateral))
                await awaitTx(d.controller.claimBuyOrder(d.investor3Addr, batchId, collateral))

                // claimed once before
                expect(await isEthException(d.marketMaker.claimBuyOrder(d.investor2Addr, batchId, collateral))).to.be.true
            })

            it("should batch multiple sell orders and let each of them be claimed", async () => {
                let collateral = d.usdToken.address
                let sellOrders = [toEth(1_000), toEth(1_000), toEth(1_000)]

                let allSellToken = sellOrders.reduce((prev, curr, currIndex, arrayIsEqual) => {
                    return prev.add(curr)
                })

                await mineToNewBatchId()
                let batchId = await d.marketMaker.getCurrentBatchId()

                let reserveBalance = await d.reserve.balanceERC20(collateral)
                await awaitTx(d.controller.updateTappedAmount(collateral))
                let tappedReserveBalance = reserveBalance.sub(await d.tap.getMaximumWithdrawal(collateral))

                let beforeSupply = (await d.engaToken.totalSupply()).add(await d.marketMaker.tokensToBeMinted())
                let beforeTotalSupply = beforeSupply.add(mmCollateralConfig.virtualSupply)
                let beforeBalance = tappedReserveBalance.add(mmCollateralConfig.virtualBalance).sub(await d.marketMaker.collateralsToBeClaimed(collateral))

                await awaitTx(d.controller.connect(d.investor1).openSellOrder(collateral, sellOrders[0]))
                await awaitTx(d.controller.connect(d.investor2).openSellOrder(collateral, sellOrders[1]))
                await awaitTx(d.controller.connect(d.investor2).openSellOrder(collateral, sellOrders[2]))

                let collateralToClaim = await d.bancor.calculateSaleReturn(beforeTotalSupply, beforeBalance, mmCollateralConfig.reserveRatioPPM, allSellToken)
                expect(collateralToClaim).to.be.eq(await d.marketMaker.collateralsToBeClaimed(collateral))

                await mineToNewBatchId()

                let investor1Bal = await d.usdToken.balanceOf(d.investor1Addr)
                let investor2Bal = await d.usdToken.balanceOf(d.investor2Addr)

                let allInvestorsBal = investor1Bal.add(investor2Bal)

                await awaitTx(d.controller.claimSellOrder(d.investor1Addr, batchId, collateral))
                await awaitTx(d.controller.claimSellOrder(d.investor2Addr, batchId, collateral))

                let investor1BalAfterSell = await d.usdToken.balanceOf(d.investor1Addr)
                let investor2BalAfterSell = await d.usdToken.balanceOf(d.investor2Addr)

                let allInvestorsBalAfterSell = investor1BalAfterSell.add(investor2BalAfterSell)

                let allInvestorsBalFee = collateralToClaim.mul(marketMakerConfig.sellFeePct).div(PCT)
                let allInvestorsBalValue = collateralToClaim.sub(allInvestorsBalFee)

                let finalResult = allInvestorsBal.add(allInvestorsBalValue)
                expect(
                    (allInvestorsBalAfterSell.gte(finalResult.sub(2)) || allInvestorsBalAfterSell.lte(finalResult.add(2)))
                ).to.be.true
                //expect(allInvestorsBalAfterSell).to.be.eq(finalResult)

                // claimed once before
                expect(await isEthException(d.marketMaker.claimSellOrder(d.investor2Addr, batchId, collateral))).to.be.true
            })

            it("should batch multiple buy and sell orders and let each of them be claimed", async () => {
                let collateral = d.usdToken.address
                let buyOrders = [toEth(50_000), toEth(50_000), toEth(50_000), toEth(50_000)]
                let sellOrders = [toEth(2_000), toEth(2_000), toEth(2_000), toEth(2_000)]

                await mineToNewBatchId()
                let batchId = await d.marketMaker.getCurrentBatchId()

                let reserveBalance = await d.reserve.balanceERC20(collateral)
                await awaitTx(d.controller.updateTappedAmount(collateral))

                let tokensToBeMinted = await d.marketMaker.tokensToBeMinted()
                let collateralsToBeClaimed = await d.marketMaker.collateralsToBeClaimed(collateral)

                let lastPriceAtUpdatePrice = await dynamicPricePPM()
                let currentPriceAfterUpdatePrice = BigNumber.from(0)

                let lastBuyReturn = (await d.marketMaker.getBatch(batchId, collateral)).totalBuyReturn
                let lastSellReturn = (await d.marketMaker.getBatch(batchId, collateral)).totalSellReturn
                await awaitTx(d.controller.connect(d.investor1).openBuyOrder(collateral, buyOrders[0]))
                tokensToBeMinted = tokensToBeMinted.sub(lastBuyReturn).add((await d.marketMaker.getBatch(batchId, collateral)).totalBuyReturn)
                collateralsToBeClaimed = collateralsToBeClaimed.sub(lastSellReturn).add((await d.marketMaker.getBatch(batchId, collateral)).totalSellReturn)

                // buy order, price must increase
                currentPriceAfterUpdatePrice = await dynamicPricePPM()
                expect(currentPriceAfterUpdatePrice.gt(lastPriceAtUpdatePrice)).to.be.true
                lastPriceAtUpdatePrice = currentPriceAfterUpdatePrice

                lastBuyReturn = (await d.marketMaker.getBatch(batchId, collateral)).totalBuyReturn
                lastSellReturn = (await d.marketMaker.getBatch(batchId, collateral)).totalSellReturn
                await awaitTx(d.controller.connect(d.investor1).openSellOrder(collateral, sellOrders[0]))
                tokensToBeMinted = tokensToBeMinted.sub(lastBuyReturn).add((await d.marketMaker.getBatch(batchId, collateral)).totalBuyReturn)
                collateralsToBeClaimed = collateralsToBeClaimed.sub(lastSellReturn).add((await d.marketMaker.getBatch(batchId, collateral)).totalSellReturn)

                // sell order, price must decrease
                currentPriceAfterUpdatePrice = await dynamicPricePPM()
                expect(currentPriceAfterUpdatePrice.lt(lastPriceAtUpdatePrice)).to.be.true
                lastPriceAtUpdatePrice = currentPriceAfterUpdatePrice

                lastBuyReturn = (await d.marketMaker.getBatch(batchId, collateral)).totalBuyReturn
                lastSellReturn = (await d.marketMaker.getBatch(batchId, collateral)).totalSellReturn
                await awaitTx(d.controller.connect(d.investor2).openBuyOrder(collateral, buyOrders[1]))
                tokensToBeMinted = tokensToBeMinted.sub(lastBuyReturn).add((await d.marketMaker.getBatch(batchId, collateral)).totalBuyReturn)
                collateralsToBeClaimed = collateralsToBeClaimed.sub(lastSellReturn).add((await d.marketMaker.getBatch(batchId, collateral)).totalSellReturn)

                // buy order, price must increase
                currentPriceAfterUpdatePrice = await dynamicPricePPM()
                expect(currentPriceAfterUpdatePrice.gt(lastPriceAtUpdatePrice)).to.be.true
                lastPriceAtUpdatePrice = currentPriceAfterUpdatePrice

                lastBuyReturn = (await d.marketMaker.getBatch(batchId, collateral)).totalBuyReturn
                lastSellReturn = (await d.marketMaker.getBatch(batchId, collateral)).totalSellReturn
                await awaitTx(d.controller.connect(d.investor2).openSellOrder(collateral, sellOrders[1]))
                tokensToBeMinted = tokensToBeMinted.sub(lastBuyReturn).add((await d.marketMaker.getBatch(batchId, collateral)).totalBuyReturn)
                collateralsToBeClaimed = collateralsToBeClaimed.sub(lastSellReturn).add((await d.marketMaker.getBatch(batchId, collateral)).totalSellReturn)

                // sell order, price must decrease
                currentPriceAfterUpdatePrice = await dynamicPricePPM()
                expect(currentPriceAfterUpdatePrice.lt(lastPriceAtUpdatePrice)).to.be.true
                lastPriceAtUpdatePrice = currentPriceAfterUpdatePrice

                lastBuyReturn = (await d.marketMaker.getBatch(batchId, collateral)).totalBuyReturn
                lastSellReturn = (await d.marketMaker.getBatch(batchId, collateral)).totalSellReturn
                await awaitTx(d.controller.connect(d.investor2).openBuyOrder(collateral, buyOrders[2]))
                tokensToBeMinted = tokensToBeMinted.sub(lastBuyReturn).add((await d.marketMaker.getBatch(batchId, collateral)).totalBuyReturn)
                collateralsToBeClaimed = collateralsToBeClaimed.sub(lastSellReturn).add((await d.marketMaker.getBatch(batchId, collateral)).totalSellReturn)

                // buy order, price must increase
                currentPriceAfterUpdatePrice = await dynamicPricePPM()
                expect(currentPriceAfterUpdatePrice.gt(lastPriceAtUpdatePrice)).to.be.true
                lastPriceAtUpdatePrice = currentPriceAfterUpdatePrice

                lastBuyReturn = (await d.marketMaker.getBatch(batchId, collateral)).totalBuyReturn
                lastSellReturn = (await d.marketMaker.getBatch(batchId, collateral)).totalSellReturn
                await awaitTx(d.controller.connect(d.investor2).openSellOrder(collateral, sellOrders[2]))
                tokensToBeMinted = tokensToBeMinted.sub(lastBuyReturn).add((await d.marketMaker.getBatch(batchId, collateral)).totalBuyReturn)
                collateralsToBeClaimed = collateralsToBeClaimed.sub(lastSellReturn).add((await d.marketMaker.getBatch(batchId, collateral)).totalSellReturn)

                // sell order, price must decrease
                currentPriceAfterUpdatePrice = await dynamicPricePPM()
                expect(currentPriceAfterUpdatePrice.lt(lastPriceAtUpdatePrice)).to.be.true
                lastPriceAtUpdatePrice = currentPriceAfterUpdatePrice

                lastBuyReturn = (await d.marketMaker.getBatch(batchId, collateral)).totalBuyReturn
                lastSellReturn = (await d.marketMaker.getBatch(batchId, collateral)).totalSellReturn
                await awaitTx(d.controller.connect(d.investor3).openBuyOrder(collateral, buyOrders[3]))
                tokensToBeMinted = tokensToBeMinted.sub(lastBuyReturn).add((await d.marketMaker.getBatch(batchId, collateral)).totalBuyReturn)
                collateralsToBeClaimed = collateralsToBeClaimed.sub(lastSellReturn).add((await d.marketMaker.getBatch(batchId, collateral)).totalSellReturn)

                // buy order, price must increase
                currentPriceAfterUpdatePrice = await dynamicPricePPM()
                expect(currentPriceAfterUpdatePrice.gt(lastPriceAtUpdatePrice)).to.be.true
                lastPriceAtUpdatePrice = currentPriceAfterUpdatePrice

                lastBuyReturn = (await d.marketMaker.getBatch(batchId, collateral)).totalBuyReturn
                lastSellReturn = (await d.marketMaker.getBatch(batchId, collateral)).totalSellReturn
                await awaitTx(d.controller.connect(d.investor3).openSellOrder(collateral, sellOrders[3]))
                tokensToBeMinted = tokensToBeMinted.sub(lastBuyReturn).add((await d.marketMaker.getBatch(batchId, collateral)).totalBuyReturn)
                collateralsToBeClaimed = collateralsToBeClaimed.sub(lastSellReturn).add((await d.marketMaker.getBatch(batchId, collateral)).totalSellReturn)

                // sell order, price must decrease
                currentPriceAfterUpdatePrice = await dynamicPricePPM()
                expect(currentPriceAfterUpdatePrice.lt(lastPriceAtUpdatePrice)).to.be.true
                lastPriceAtUpdatePrice = currentPriceAfterUpdatePrice

                expect(tokensToBeMinted).to.be.eq(await d.marketMaker.tokensToBeMinted())
                expect(collateralsToBeClaimed).to.be.eq(await d.marketMaker.collateralsToBeClaimed(collateral))

                await awaitTx(d.controller.claimBuyOrder(d.investor1Addr, batchId, collateral))
                await awaitTx(d.controller.claimBuyOrder(d.investor2Addr, batchId, collateral))
                await awaitTx(d.controller.claimBuyOrder(d.investor3Addr, batchId, collateral))

                await awaitTx(d.controller.claimSellOrder(d.investor1Addr, batchId, collateral))
                await awaitTx(d.controller.claimSellOrder(d.investor2Addr, batchId, collateral))
                await awaitTx(d.controller.claimSellOrder(d.investor3Addr, batchId, collateral))
            })

            it("should enable kyc mechanism", async () => {
                expect(await d.kyc.isKycEnable()).to.be.false

                let { id } = await multisigCall(d.controller.address, 'enableKyc()', encodeParams([], []))
                expect((await d.multisig.transactions(id)).executed).to.be.true

                expect(await d.kyc.isKycEnable()).to.be.true
            })

            it("should not let users who has not done kyc buy or sell straight on market maker", async () => {
                let collateral = d.usdToken.address
                let buyOrders = [toEth(30_000), toEth(50_000), toEth(65_000), toEth(400_000)]
                let sellOrders = [toEth(3_000), toEth(10_000), toEth(23_000), toEth(100_000)]

                expect(await isEthException(d.controller.connect(d.investor1).openBuyOrder(collateral, buyOrders[0]))).to.be.true
                expect(await isEthException(d.controller.connect(d.investor2).openBuyOrder(collateral, buyOrders[1]))).to.be.true

                expect(await isEthException(d.controller.connect(d.investor1).openSellOrder(collateral, sellOrders[0]))).to.be.true
                expect(await isEthException(d.controller.connect(d.investor2).openSellOrder(collateral, sellOrders[1]))).to.be.true
            })

            it("should add new user to kyc list to let them participate in buy and sell", async () => {
                expect(await isEthException(d.kyc.connect(d.owner2).addKycUser(d.investor1Addr))).to.be.true
                expect(await isEthException(d.kyc.connect(d.owner1).addKycUser(d.investor1Addr))).to.be.true

                expect(await addKycUser(d.investor1Addr)).to.be.true
                expect(await d.kyc.getKycOfUser(d.investor1Addr)).to.be.true
                expect(await d.controller.getKycOfUser(d.investor1Addr)).to.be.true

                expect(await addKycUser(d.investor1Addr)).to.be.false // re-adding fails
            })

            it("should let new kyc user participate in sell or buy", async () => {
                let collateral = d.usdToken.address

                // buy order
                let beforeTokensToBeMinted = await d.marketMaker.tokensToBeMinted()
                r = await awaitTx(d.controller.connect(d.investor1).openBuyOrder(collateral, toEth(1)))
                expect((await d.marketMaker.tokensToBeMinted()).gt(beforeTokensToBeMinted)).to.be.true
                expect(await isEthException(d.controller.connect(d.investor2).openBuyOrder(collateral, toEth(1)))).to.be.true

                // sell order
                let beforeCollateralsToBeClaimed = await d.marketMaker.collateralsToBeClaimed(collateral)
                r = await awaitTx(d.controller.connect(d.investor1).openSellOrder(collateral, toEth(0.1)))
                expect((await d.marketMaker.collateralsToBeClaimed(collateral)).gt(beforeCollateralsToBeClaimed)).to.be.true
                expect(await isEthException(d.controller.connect(d.investor2).openSellOrder(collateral, toEth(0.1)))).to.be.true
            })

            it("should remove the kyc user", async () => {
                expect(await isEthException(d.kyc.connect(d.owner2).removeKycUser(d.investor1Addr)))
                expect(await isEthException(d.kyc.connect(d.owner1).removeKycUser(d.investor1Addr)))

                expect(await removeKycUser(d.investor1Addr)).to.be.true
                expect(await d.kyc.getKycOfUser(d.investor1Addr)).to.be.false

                expect(await removeKycUser(d.investor1Addr)).to.be.false // removing fails for the second time
            })

            it("should not let user who has been removed from kyc list buy or sell straight on market maker", async () => {
                let collateral = d.usdToken.address

                expect(await isEthException(d.controller.connect(d.investor1).openBuyOrder(collateral, toEth(1)))).to.be.true
                expect(await isEthException(d.controller.connect(d.investor1).openSellOrder(collateral, toEth(1)))).to.be.true
            })

            it("should disable kyc mechanism", async () => {
                expect(await d.kyc.isKycEnable()).to.be.true

                await multisigCall(d.controller.address, 'disableKyc()', encodeParams([], []))

                expect(await d.kyc.isKycEnable()).to.be.false
            })

            it("should not let users to call suspend", async () => {
                expect(await d.marketMaker.isSuspended()).to.be.false
                expect(await isEthException(d.controller.connect(d.owner2).suspendMarketMaker(true))).to.be.true
                expect(await isEthException(d.controller.connect(d.owner1).suspendMarketMaker(true))).to.be.true
                expect(await isEthException(d.controller.connect(d.owner3).suspendMarketMaker(true))).to.be.true
                expect(await isEthException(d.controller.connect(d.owner4).suspendMarketMaker(true))).to.be.true
                expect(await d.marketMaker.isSuspended()).to.be.false
            })

            it("should allow multisig to call suspend", async () => {
                expect(await d.marketMaker.isSuspended()).to.be.false
                let res = await multisigCall(d.controller.address, 'suspendMarketMaker(bool)', encodeParams(['bool'], [true]))
                expect((await d.multisig.transactions(res.id)).executed).to.be.true
                expect(await d.marketMaker.isSuspended()).to.be.true
            })

            it("should not allow to call suspend twice with the same value", async () => {
                expect(await d.marketMaker.isSuspended()).to.be.true
                let res = await multisigCall(d.controller.address, 'suspendMarketMaker(bool)', encodeParams(['bool'], [true]))
                expect((await d.multisig.transactions(res.id)).executed).to.be.false
                expect(await d.marketMaker.isSuspended()).to.be.true
            })

            it("should not allow users to participate", async () => {
                expect(await isEthException(d.controller.connect(d.investor1).openBuyOrder(d.usdToken.address, toEth(1)))).to.be.true
                expect(await isEthException(d.controller.connect(d.investor1).openSellOrder(d.usdToken.address, toEth(1)))).to.be.true
            })

            it("should allow to unsuspend the market maker again", async () => {
                expect(await d.marketMaker.isSuspended()).to.be.true
                let res = await multisigCall(d.controller.address, 'suspendMarketMaker(bool)', encodeParams(['bool'], [false]))
                expect((await d.multisig.transactions(res.id)).executed).to.be.true
                expect(await d.marketMaker.isSuspended()).to.be.false
            })

            it("should allow users to participate", async () => {
                await awaitTx(d.controller.connect(d.investor1).openBuyOrder(d.usdToken.address, toEth(1)))
                await awaitTx(d.controller.connect(d.investor1).openSellOrder(d.usdToken.address, toEth(1)))
            })
        })

        describe("adding extra sale process", async () => {
            it("should not allow extra sale to be added when seed sale and private sale went successful", async () => {
                expect(await d.preSale.state()).to.be.eq(FundraisingState.Closed)

                let { id } = await multisigCall(d.controller.address, 'setNewSaleAddress(address)', encodeParams(['address'], [newPreSale.address]))
                expect((await d.multisig.transactions(id)).executed).to.be.false
            })
        })

        describe("Vault security", async () => {
            describe("Multisig Vault", async () => {
                it("should not allow anyone to call transferERC20 on multisig", async () => {
                    let token = d.usdToken.address
                    let to = d.owner2Addr
                    let amount = toEth(1000)

                    expect(await isEthException(d.multisig.connect(d.owner2).transferERC20(token, to, amount))).to.be.true
                    expect(await isEthException(d.multisig.connect(d.owner1).transferERC20(token, to, amount))).to.be.true
                    expect(await isEthException(d.multisig.connect(d.owner3).transferERC20(token, to, amount))).to.be.true
                    expect(await isEthException(d.multisig.connect(d.owner4).transferERC20(token, to, amount))).to.be.true
                    expect(await isEthException(d.multisig.connect(d.investor1).transferERC20(token, to, amount))).to.be.true
                    expect(await isEthException(d.multisig.connect(d.intruder).transferERC20(token, to, amount))).to.be.true
                    expect(await isEthException(d.multisig.connect(d.investor2).transferERC20(token, to, amount))).to.be.true
                })
            })

            describe("Reserve Vault", async () => {
                it("should not allow anyone to call transferERC20 directly on reserve", async () => {
                    let token = d.usdToken.address
                    let to = d.owner2Addr
                    let amount = toEth(1000)

                    expect(await isEthException(d.reserve.connect(d.owner2).transferERC20(token, to, amount))).to.be.true
                    expect(await isEthException(d.reserve.connect(d.owner1).transferERC20(token, to, amount))).to.be.true
                    expect(await isEthException(d.reserve.connect(d.investor1).transferERC20(token, to, amount))).to.be.true
                    expect(await isEthException(d.reserve.connect(d.intruder).transferERC20(token, to, amount))).to.be.true
                    expect(await isEthException(d.reserve.connect(d.owner3).transferERC20(token, to, amount))).to.be.true

                    let { id } = await multisigCall(d.reserve.address, 'transferERC20(address,address,uint256)', encodeParams(['address', 'address', 'uint256'], [token, to, amount]))
                    expect((await d.multisig.transactions(id)).executed).to.be.false
                })

                it("should not allow deployer to call transferERC20", async () => {
                    let token = d.usdToken.address
                    let to = d.owner2Addr
                    let amount = toEth(1000)

                    let beforeBalance = await d.usdToken.balanceOf(to)

                    expect(await isEthException(d.reserve.transferERC20(token, to, amount))).to.be.true

                    expect(await d.usdToken.balanceOf(to)).to.be.eq(beforeBalance)
                })

                it("should not allow multisig to call transferERC20 directly", async () => {
                    let token = d.usdToken.address
                    let to = d.owner2Addr
                    let amount = toEth(1000)

                    let beforeBalance = await d.usdToken.balanceOf(to)

                    let { r, id } = await multisigCall(d.reserve.address, 'transferERC20(address,address,uint256)', encodeParams(['address', 'address', 'uint256'], [token, to, amount]))
                    expect((await d.multisig.transactions(id)).executed).to.be.false
                    let func = () => d.reserve.interface.decodeFunctionResult("transferERC20", execEventArgs(r).returndata)
                    expect(isThrownError(func)).to.be.true

                    expect(await d.usdToken.balanceOf(to)).to.be.eq(beforeBalance)
                })
            })

            describe("Treasury Vault", async () => {
                it("should not allow anyone to call transferERC20 directly on treasury", async () => {
                    let token = d.usdToken.address
                    let to = d.owner2Addr
                    let amount = toEth(1000)

                    expect(await isEthException(d.treasury.connect(d.owner2).transferERC20(token, to, amount))).to.be.true
                    expect(await isEthException(d.treasury.connect(d.owner1).transferERC20(token, to, amount))).to.be.true
                    expect(await isEthException(d.treasury.connect(d.investor1).transferERC20(token, to, amount))).to.be.true
                    expect(await isEthException(d.treasury.connect(d.intruder).transferERC20(token, to, amount))).to.be.true
                    expect(await isEthException(d.treasury.connect(d.owner3).transferERC20(token, to, amount))).to.be.true

                    expect(await isEthException(d.controller.connect(d.owner2).treasuryTransfer(token, to, amount))).to.be.true
                    expect(await isEthException(d.controller.connect(d.owner1).treasuryTransfer(token, to, amount))).to.be.true
                    expect(await isEthException(d.controller.connect(d.investor1).treasuryTransfer(token, to, amount))).to.be.true
                    expect(await isEthException(d.controller.connect(d.intruder).treasuryTransfer(token, to, amount))).to.be.true
                    expect(await isEthException(d.controller.connect(d.owner3).treasuryTransfer(token, to, amount))).to.be.true

                    let { id } = await multisigCall(d.treasury.address, 'transferERC20(address,address,uint256)', encodeParams(['address', 'address', 'uint256'], [token, to, amount]))
                    expect((await d.multisig.transactions(id)).executed).to.be.false
                })

                it("should not allow deployer to call transferERC20", async () => {
                    let token = d.usdToken.address
                    let to = d.owner2Addr
                    let amount = toEth(1000)

                    let beforeBalance = await d.usdToken.balanceOf(to)

                    expect(await isEthException(d.reserve.transferERC20(token, to, amount))).to.be.true

                    expect(await d.usdToken.balanceOf(to)).to.be.eq(beforeBalance)
                })

                it("should allow multisig to call transfer on controller", async () => {
                    let token = d.usdToken.address
                    let to = d.owner2Addr
                    let amount = toEth(1) // ~ 25 + 97.5

                    let beforeBalance = await d.usdToken.balanceOf(to)

                    let { id } = await multisigCall(d.controller.address, 'treasuryTransfer(address,address,uint256)', encodeParams(['address', 'address', 'uint256'], [token, to, amount]))
                    expect((await d.multisig.transactions(id)).executed).to.be.true

                    expect(await d.usdToken.balanceOf(to)).to.be.eq(beforeBalance.add(amount))
                })
            })
        })

        describe("unlock vestings", async () => {
            it("should not allow core members or multisig to release a vesting from tokenManager", async () => {
                let lastVestId = vestedIds[1][vestedIds[1].length - 1]

                expect(await isEthException(d.tokenManager.connect(d.owner2).release(lastVestId))).to.be.true
                expect(await isEthException(d.tokenManager.connect(d.owner1).release(lastVestId))).to.be.true
                expect(await isEthException(d.tokenManager.connect(d.owner3).release(lastVestId))).to.be.true
                expect(await isEthException(d.tokenManager.connect(d.owner4).release(lastVestId))).to.be.true

                let res = await multisigCall(d.tokenManager.address, 'release(bytes32)', encodeParams(['bytes32'], [lastVestId]))
                expect((await d.multisig.transactions(res.id)).executed).to.be.false
            })

            it("should set the new time to let users be able to release their vestings", async () => {
                let lastVestId = vestedIds[1][vestedIds[1].length - 1]
                let lastCliffTime = (await d.tokenManager.getVesting(lastVestId)).cliff
                let timeToLetRelease = lastCliffTime.sub(await getCurrentNetworkTime())

                if (timeToLetRelease.gt(0)) {
                    expect(await isEthException(d.controller.release(lastVestId))).to.be.true
                    expect(await d.tokenManager.computeReleasableAmount(lastVestId)).to.be.eq(0)

                    await waitFor(Number(timeToLetRelease))
                }
            })

            it("should let users[1,2,3,4] withdraw some amount of their vesting when cliff date has passed", async () => {
                await waitFor(1 * months)

                for (let investorIndex = 1; investorIndex < 5; investorIndex++) {
                    let vestingIds: string[] = []
                    let investor: string = ''

                    if (investorIndex === 1) {
                        vestingIds = vestedIds[1]
                        investor = d.investor1Addr
                    } else if (investorIndex === 2) {
                        vestingIds = vestedIds[2]
                        investor = d.investor2Addr
                    } else if (investorIndex === 3) {
                        vestingIds = vestedIds[3]
                        investor = d.investor3Addr
                    } else if (investorIndex === 4) {
                        vestingIds = vestedIds[4]
                        investor = d.investor4Addr
                    }

                    for (let i = 0; i < vestingIds.length; i++) {
                        const id = vestingIds[i]

                        let engaBalanceBefore = await d.engaToken.balanceOf(investor)

                        expect(await release(id)).to.be.true

                        let netTime = await getCurrentNetworkTime()
                        let vest = await d.tokenManager.getVesting(id)
                        let released = (await d.tokenManager.getVesting(id)).released

                        expect(await d.tokenManager.computeReleasableAmount(id)).to.be.eq(0)
                        expect(await d.engaToken.balanceOf(investor)).to.be.eq(engaBalanceBefore.add(released))

                        //off-chain
                        let duration = vest.end.sub(vest.cliff)
                        let passed = BigNumber.from(netTime).sub(vest.cliff)
                        let vestedAmount = vest.amountTotal.mul(passed).div(duration)

                        expect(vestedAmount.sub(vest.released)).to.be.eq(0)
                    }
                }
            })

            it("should let users release more amount after some time has passed again", async () => {
                await waitFor(3 * months)

                for (let investorIndex = 1; investorIndex < 5; investorIndex++) {
                    let vestingIds: string[] = []
                    let investor: string = ''

                    if (investorIndex === 1) {
                        vestingIds = vestedIds[1]
                        investor = d.investor1Addr
                    } else if (investorIndex === 2) {
                        vestingIds = vestedIds[2]
                        investor = d.investor2Addr
                    } else if (investorIndex === 3) {
                        vestingIds = vestedIds[3]
                        investor = d.investor3Addr
                    } else if (investorIndex === 4) {
                        vestingIds = vestedIds[4]
                        investor = d.investor4Addr
                    }

                    for (let i = 0; i < vestingIds.length; i++) {
                        const id = vestingIds[i]
                        expect(await isEthException(d.tokenManager.connect(d.investor1).release(id))).to.be.true
                        expect(await isEthException(d.tokenManager.connect(d.investor2).release(id))).to.be.true
                        expect(await isEthException(d.tokenManager.connect(d.investor3).release(id))).to.be.true
                        expect(await isEthException(d.tokenManager.connect(d.investor4).release(id))).to.be.true
                        expect(await isEthException(d.tokenManager.connect(d.investor5).release(id))).to.be.true
                        expect(await isEthException(d.tokenManager.connect(d.owner1).release(id))).to.be.true
                        expect(await isEthException(d.tokenManager.connect(d.owner2).release(id))).to.be.true
                        expect(await isEthException(d.tokenManager.connect(d.owner3).release(id))).to.be.true
                        expect(await isEthException(d.tokenManager.connect(d.owner4).release(id))).to.be.true

                        let engaBalanceBefore = await d.engaToken.balanceOf(investor)
                        let beforeRelease = (await d.tokenManager.getVesting(id)).released

                        expect(await release(id)).to.be.true

                        let netTime = await getCurrentNetworkTime()
                        let vest = await d.tokenManager.getVesting(id)
                        let released = (await d.tokenManager.getVesting(id)).released.sub(beforeRelease)

                        expect((await d.tokenManager.getVesting(id)).released).to.be.eq(beforeRelease.add(released))
                        expect(await d.tokenManager.computeReleasableAmount(id)).to.be.eq(0)
                        expect(await d.engaToken.balanceOf(investor)).to.be.eq(engaBalanceBefore.add(released))

                        //off-chain
                        let duration = vest.end.sub(vest.cliff)
                        let passed = BigNumber.from(netTime).sub(vest.cliff)
                        let vestedAmount = vest.amountTotal.mul(passed).div(duration)

                        expect(vestedAmount.sub(vest.released)).to.be.eq(0)
                    }
                }
            })

            it("should let users release amount of vested", async () => {
                let lastVestId = vestedIds[1][vestedIds[1].length - 1]
                let lastEndTime = (await d.tokenManager.getVesting(lastVestId)).end
                let timeToLetFullRelease = lastEndTime.sub(await getCurrentNetworkTime())

                if (timeToLetFullRelease.gt(0)) {
                    await waitFor(Number(timeToLetFullRelease))
                }

                for (let investorIndex = 1; investorIndex < 5; investorIndex++) {
                    let vestingIds: string[] = []
                    let investor: string = ''

                    if (investorIndex === 1) {
                        vestingIds = vestedIds[1]
                        investor = d.investor1Addr
                    } else if (investorIndex === 2) {
                        vestingIds = vestedIds[2]
                        investor = d.investor2Addr
                    } else if (investorIndex === 3) {
                        vestingIds = vestedIds[3]
                        investor = d.investor3Addr
                    } else if (investorIndex === 4) {
                        vestingIds = vestedIds[4]
                        investor = d.investor4Addr
                    }

                    for (let i = 0; i < vestingIds.length; i++) {
                        const id = vestingIds[i]

                        let engaBalanceBefore = await d.engaToken.balanceOf(investor)
                        let beforeRelease = (await d.tokenManager.getVesting(id)).released

                        expect(await release(id)).to.be.true

                        let vest = await d.tokenManager.getVesting(id)
                        let released = (await d.tokenManager.getVesting(id)).released.sub(beforeRelease)

                        expect((await d.tokenManager.getVesting(id)).released).to.be.eq(beforeRelease.add(released))
                        expect(await d.tokenManager.computeReleasableAmount(id)).to.be.eq(0)
                        expect(await d.engaToken.balanceOf(investor)).to.be.eq(engaBalanceBefore.add(released))
                        expect(vest.amountTotal).to.be.eq(vest.released)

                        expect(await isEthException(d.tokenManager.release(id))).to.be.true
                        expect(await isEthException(d.controller.release(id))).to.be.true
                        expect(await release(id)).to.be.false
                    }
                }
            })

            it("should release treasury vault completely", async () => {
                let _beneficiary = d.treasury.address

                let id = await d.tokenManager.computeId(_beneficiary, 0)
                let lastEndTime = (await d.tokenManager.getVesting(id)).end
                let timeToLetFullRelease = lastEndTime.sub(await getCurrentNetworkTime())

                if (timeToLetFullRelease.gt(0)) {
                    await waitFor(Number(timeToLetFullRelease))
                }

                let engaBalanceBefore = await d.engaToken.balanceOf(_beneficiary)
                let beforeRelease = (await d.tokenManager.getVesting(id)).released

                expect(beforeRelease).to.be.eq(0)

                expect(await release(id)).to.be.true

                let vest = await d.tokenManager.getVesting(id)
                let released = (await d.tokenManager.getVesting(id)).released

                expect((await d.tokenManager.getVesting(id)).released).to.be.eq(beforeRelease.add(released))
                expect(await d.tokenManager.computeReleasableAmount(id)).to.be.eq(0)
                expect(await d.engaToken.balanceOf(_beneficiary)).to.be.eq(engaBalanceBefore.add(released))
                expect(vest.amountTotal).to.be.eq(vest.released)

                expect(await isEthException(d.tokenManager.release(id))).to.be.true
                expect(await isEthException(d.controller.release(id))).to.be.true
                expect(await release(id)).to.be.false
            })

            it("should release stake holder vault completely", async () => {
                let _beneficiary = d.stakeHolders.address

                let id = await d.tokenManager.computeId(_beneficiary, 0)
                let lastEndTime = (await d.tokenManager.getVesting(id)).end
                let timeToLetFullRelease = lastEndTime.sub(await getCurrentNetworkTime())

                if (timeToLetFullRelease.gt(0)) {
                    await waitFor(Number(timeToLetFullRelease))
                }

                let engaBalanceBefore = await d.engaToken.balanceOf(_beneficiary)
                let beforeRelease = (await d.tokenManager.getVesting(id)).released

                expect(beforeRelease).to.be.eq(0)

                expect(await release(id)).to.be.true

                let vest = await d.tokenManager.getVesting(id)
                let released = (await d.tokenManager.getVesting(id)).released

                expect((await d.tokenManager.getVesting(id)).released).to.be.eq(beforeRelease.add(released))
                expect(await d.tokenManager.computeReleasableAmount(id)).to.be.eq(0)
                expect(await d.engaToken.balanceOf(_beneficiary)).to.be.eq(engaBalanceBefore.add(released))
                expect(vest.amountTotal).to.be.eq(vest.released)

                expect(await isEthException(d.tokenManager.release(id))).to.be.true
                expect(await isEthException(d.controller.release(id))).to.be.true
                expect(await release(id)).to.be.false
            })


            it("should allow multisig on controller to withdraw extra token in token manager if any", async () => {
                expect(await d.tokenManager.getWithdrawableAmount()).to.be.eq(toEth(0))

                await awaitTx(d.engaToken.connect(d.investor1)["transfer(address,uint256)"](d.tokenManager.address, toEth(10)))
                await awaitTx(d.usdToken.connect(d.investor1).transfer(d.tokenManager.address, toEth(10)))

                expect(await d.tokenManager.getWithdrawableAmount()).to.be.eq(toEth(10))
                expect(await d.usdToken.balanceOf(d.tokenManager.address)).to.be.eq(toEth(10))

                {   // FAILS BECAUSE WE DONT HAVE PERMISSON IN TOKEN MANGER TO CALL WITHDRAW
                    expect(await d.engaToken.balanceOf(d.investor5Addr)).to.be.eq(0)
                    let { id } = await multisigCall(d.tokenManager.address, 'withdraw(address,address,uint256)', encodeParams(['address', 'address', 'uint256'], [d.engaToken.address, d.investor5Addr, toEth(10)]))
                    expect((await d.multisig.transactions(id)).executed).to.be.false
                    expect(await d.engaToken.balanceOf(d.investor5Addr)).to.be.eq(0)
                    expect(await d.tokenManager.getWithdrawableAmount()).to.be.eq(toEth(10))
                }

                {
                    expect(await d.engaToken.balanceOf(d.investor5Addr)).to.be.eq(0)
                    let { id } = await multisigCall(d.controller.address, 'withdrawTokenManger(address,address,uint256)', encodeParams(['address', 'address', 'uint256'], [d.engaToken.address, d.investor5Addr, toEth(10)]))
                    expect((await d.multisig.transactions(id)).executed).to.be.true
                    expect(await d.engaToken.balanceOf(d.investor5Addr)).to.be.eq(toEth(10))
                    expect(await d.tokenManager.getWithdrawableAmount()).to.be.eq(toEth(0))
                }

                {
                    let beforeUsdBalanceInvestor = await d.usdToken.balanceOf(d.investor5Addr)
                    expect(await d.usdToken.balanceOf(d.tokenManager.address)).to.be.eq(toEth(10))
                    let { id } = await multisigCall(d.controller.address, 'withdrawTokenManger(address,address,uint256)', encodeParams(['address', 'address', 'uint256'], [d.usdToken.address, d.investor5Addr, toEth(10)]))
                    expect((await d.multisig.transactions(id)).executed).to.be.true
                    expect(await d.usdToken.balanceOf(d.tokenManager.address)).to.be.eq(toEth(0))
                    expect(await d.usdToken.balanceOf(d.investor5Addr)).to.be.eq(beforeUsdBalanceInvestor.add(toEth(10)))
                }

                {
                    // FAILS BECAUSE WE DONT HAVE ENOUGH ENGA TOKEN TO WITHDRAW
                    let { id } = await multisigCall(d.controller.address, 'withdrawTokenManger(address,address,uint256)', encodeParams(['address', 'address', 'uint256'], [d.engaToken.address, d.investor5Addr, toEth(10)]))
                    expect((await d.multisig.transactions(id)).executed).to.be.false
                }

                {
                    // FAILS BECAUSE WE DONT HAVE ENOUGH USD TOKEN TO WITHDRAW
                    let { id } = await multisigCall(d.controller.address, 'withdrawTokenManger(address,address,uint256)', encodeParams(['address', 'address', 'uint256'], [d.usdToken.address, d.investor5Addr, toEth(10)]))
                    expect((await d.multisig.transactions(id)).executed).to.be.false
                }
            })
        })

        describe("StakeHolders Payment splitting", async () => {
            it("should distribute tokens to the stake holders", async () => {
                let token = d.engaToken.address

                let owner1BalBefore = await d.engaToken.balanceOf(d.owner1Addr)
                let owner2BalBefore = await d.engaToken.balanceOf(d.owner2Addr)
                let owner3BalBefore = await d.engaToken.balanceOf(d.owner3Addr)
                let owner4BalBefore = await d.engaToken.balanceOf(d.owner4Addr)

                let stakeHolderBal = await d.engaToken.balanceOf(d.stakeHolders.address)
                
                let ownerShares = calculateSyntheticShare(4)
                let totalShares = ownerShares.reduce((a, b) => a + b, 0)

                let owner1BalanaceOfShare = stakeHolderBal.mul(ownerShares[0]).div(totalShares)
                let owner2BalanaceOfShare = stakeHolderBal.mul(ownerShares[1]).div(totalShares)
                let owner3BalanaceOfShare = stakeHolderBal.mul(ownerShares[2]).div(totalShares)
                let owner4BalanaceOfShare = stakeHolderBal.mul(ownerShares[3]).div(totalShares)

                expect(await d.stakeHolders.shares(d.owner1Addr)).to.be.eq(ownerShares[0])
                expect(await d.stakeHolders.shares(d.owner2Addr)).to.be.eq(ownerShares[1])
                expect(await d.stakeHolders.shares(d.owner3Addr)).to.be.eq(ownerShares[2])
                expect(await d.stakeHolders.shares(d.owner4Addr)).to.be.eq(ownerShares[3])

                expect(await d.stakeHolders.totalShares()).to.be.eq(totalShares)

                await awaitTx(d.stakeHolders["release(address,address)"](token, d.owner1Addr))
                await awaitTx(d.stakeHolders["release(address,address)"](token, d.owner2Addr))
                await awaitTx(d.stakeHolders["release(address,address)"](token, d.owner3Addr))
                await awaitTx(d.stakeHolders["release(address,address)"](token, d.owner4Addr))

                expect(await d.engaToken.balanceOf(d.owner1Addr)).to.be.eq(owner1BalBefore.add(owner1BalanaceOfShare))
                expect(await d.engaToken.balanceOf(d.owner2Addr)).to.be.eq(owner2BalBefore.add(owner2BalanaceOfShare))
                expect(await d.engaToken.balanceOf(d.owner3Addr)).to.be.eq(owner3BalBefore.add(owner3BalanaceOfShare))
                expect(await d.engaToken.balanceOf(d.owner4Addr)).to.be.eq(owner4BalBefore.add(owner4BalanaceOfShare))
            })
        })

        describe("protocol lock mechanism", async () => {
            it("should not allow anyone else than multisig to call setProtocolStatus", async () => {
                expect(await isEthException(d.controller.connect(d.owner2).setProtocolState(true))).to.be.true
                expect(await isEthException(d.controller.connect(d.owner1).setProtocolState(true))).to.be.true
                expect(await isEthException(d.controller.connect(d.owner3).setProtocolState(true))).to.be.true
                expect(await isEthException(d.controller.connect(d.owner4).setProtocolState(true))).to.be.true
            })

            it("should not allow any transaction go through the controller contract", async () => {
                let target = d.controller.address
                let sig = 'setProtocolState(bool)'
                let collateral = d.usdToken.address

                expect(await d.controller.isProtocolLocked()).to.be.false

                await awaitTx(d.controller.connect(d.investor1).openBuyOrder(collateral, toEth(1)))

                let res = await multisigCall(target, sig, encodeParams(['bool'], [true]))
                expect((await d.multisig.transactions(res.id)).executed).to.be.true

                expect(await d.controller.isProtocolLocked()).to.be.true

                expect(await isEthException(d.controller.connect(d.investor1).openBuyOrder(collateral, toEth(1)))).to.be.true
                expect(await isEthException(d.controller.connect(d.investor1).openSellOrder(collateral, toEth(1)))).to.be.true
                expect(await isEthException(d.controller.withdrawTap(collateral))).to.be.true
                expect(await isEthException(d.controller.updateTappedAmount(collateral))).to.be.true

                res = await multisigCall(target, sig, encodeParams(['bool'], [false]))
                expect((await d.multisig.transactions(res.id)).executed).to.be.true

                expect(await d.controller.isProtocolLocked()).to.be.false

                await awaitTx(d.controller.updateTappedAmount(collateral))
                expect(await withdrawTap()).to.be.true
            })
        })
    })

    describe("SeedSale process", async () => {
        it("should check the deployment of the SeedSale", async () => {
            expect(await d.seedSale.daiGoal()).to.be.eq(seedSaleConfig.daiGoal)
            expect(await d.seedSale.engaGoal()).to.be.eq(seedSaleConfig.engaGoal)
            expect(await d.seedSale.vestingCliffPeriod()).to.be.eq(seedSaleConfig.cliffPeroid)
            expect(await d.seedSale.vestingCompletePeriod()).to.be.eq(seedSaleConfig.completePeroid)
            expect(await d.seedSale.minimumRequiredToken()).to.be.eq(seedSaleConfig.minimumRequiredToken)
            expect(await d.seedSale.state()).to.be.eq(FundraisingState.Pending)
        })

        it("should ckeck for the amount of enga token passed to it", async () => {
            expect(await d.engaToken.balanceOf(d.seedSale.address)).to.be.eq(SEED_SALE_SHARE)
        })

        it("should check for the addresses", async () => {
            let zero = ethers.constants.AddressZero
            expect(await d.seedSale.spaceRhinoBeneficiary()).to.be.eq(d.multisig.address)
            expect(await d.seedSale.contributionToken()).to.be.eq(zero)
            expect(await d.seedSale.engaToken()).to.be.eq(zero)
        })

        it("should check for the roles", async () => {
            let DEFAULT_ADMIN_ROLE = BYTES32_ZERO
            expect(await d.seedSale.hasRole(DEFAULT_ADMIN_ROLE, d.multisig.address)).to.be.true
            expect(await d.seedSale.hasRole(OPEN_ROLE, d.multisig.address)).to.be.true
            expect(await d.seedSale.hasRole(OPEN_ROLE, d.owner2Addr)).to.be.true
        })

        it("should not allow to call open before setting new addresses", async () => {
            expect(await d.seedSale.isOpen()).to.be.false
            expect(await isEthException(d.seedSale.openNow())).to.be.true
            expect(await d.seedSale.isOpen()).to.be.false
        })

        it("should allow us to set addresses", async () => {
            await awaitTx(d.seedSale.initializeAddresses(d.usdToken.address, d.engaToken.address))

            expect(await d.seedSale.contributionToken()).to.be.eq(d.usdToken.address)
            expect(await d.seedSale.engaToken()).to.be.eq(d.engaToken.address)
        })

        it("should allow us to open the sale", async () => {
            expect(await d.seedSale.isOpen()).to.be.false
            let r = await awaitTx(d.seedSale.openNow())
            expect(await d.seedSale.isOpen()).to.be.true
            expect(await d.seedSale.state()).to.be.eq(FundraisingState.Funding)

            let openedEvent = getEvent(r, "SaleOpened")
            expect(openedEvent !== undefined && openedEvent !== null).to.be.true
        })

        it("should allow users to contribute", async () => {
            let usdValue = seedSaleConfig.daiGoal.div(4)
            let engaValue = usdValue.mul(await d.seedSale.getExchangeRate()).div(PPM)

            {
                // investor 1 vesting 0
                let beforeBalanceInvestor = await d.usdToken.balanceOf(d.investor1Addr)
                let beforeBalanceBeneficiary = await d.usdToken.balanceOf(d.multisig.address)
                let nowTime = await getCurrentNetworkTime()
                await awaitTx(d.usdToken.connect(d.investor1).approve(d.seedSale.address, usdValue))
                let r = await awaitTx(d.seedSale.connect(d.investor1).contribute(usdValue))
                expect(await d.usdToken.balanceOf(d.investor1Addr)).to.be.eq(beforeBalanceInvestor.sub(usdValue))
                expect(await d.usdToken.balanceOf(d.multisig.address)).to.be.eq(beforeBalanceBeneficiary.add(usdValue))

                let VestingCreated = getEvent(r, "VestingCreated")
                expect(VestingCreated !== undefined && VestingCreated !== null).to.be.true

                let vesting = await d.seedSale.getVestingByAddressAndIndex(d.investor1Addr, 0)
                expect(vesting.initialized).to.be.true
                expect(vesting.beneficiary).to.be.eq(d.investor1Addr)
                expect(vesting.amountTotal).to.be.eq(engaValue)
                expect(vesting.released).to.be.eq(0)
                expect(vesting.start.toNumber() >= nowTime).to.be.true
                expect(vesting.cliff.toNumber() >= seedSaleConfig.cliffPeroid + nowTime).to.be.true
                expect(vesting.end.toNumber() >= seedSaleConfig.completePeroid + nowTime).to.be.true

                expect(await d.seedSale.getHolderVestingCount(d.investor1Addr)).to.be.eq(1)
            }

            {
                // investor 1 vesting 1
                let beforeBalanceInvestor = await d.usdToken.balanceOf(d.investor1Addr)
                let beforeBalanceBeneficiary = await d.usdToken.balanceOf(d.multisig.address)
                let nowTime = await getCurrentNetworkTime()
                await awaitTx(d.usdToken.connect(d.investor1).approve(d.seedSale.address, usdValue))
                let r = await awaitTx(d.seedSale.connect(d.investor1).contribute(usdValue))
                expect(await d.usdToken.balanceOf(d.investor1Addr)).to.be.eq(beforeBalanceInvestor.sub(usdValue))
                expect(await d.usdToken.balanceOf(d.multisig.address)).to.be.eq(beforeBalanceBeneficiary.add(usdValue))

                let VestingCreated = getEvent(r, "VestingCreated")
                expect(VestingCreated !== undefined && VestingCreated !== null).to.be.true

                let vesting = await d.seedSale.getVestingByAddressAndIndex(d.investor1Addr, 1)
                expect(vesting.initialized).to.be.true
                expect(vesting.beneficiary).to.be.eq(d.investor1Addr)
                expect(vesting.amountTotal).to.be.eq(engaValue)
                expect(vesting.released).to.be.eq(0)
                expect(vesting.start.toNumber() >= nowTime).to.be.true
                expect(vesting.cliff.toNumber() >= seedSaleConfig.cliffPeroid + nowTime).to.be.true
                expect(vesting.end.toNumber() >= seedSaleConfig.completePeroid + nowTime).to.be.true

                expect(await d.seedSale.getHolderVestingCount(d.investor1Addr)).to.be.eq(2)
            }

            {
                // investor 2 vesting 0
                let beforeBalanceInvestor = await d.usdToken.balanceOf(d.investor2Addr)
                let beforeBalanceBeneficiary = await d.usdToken.balanceOf(d.multisig.address)
                let nowTime = await getCurrentNetworkTime()
                await awaitTx(d.usdToken.connect(d.investor2).approve(d.seedSale.address, usdValue))
                let r = await awaitTx(d.seedSale.connect(d.investor2).contribute(usdValue))
                expect(await d.usdToken.balanceOf(d.investor2Addr)).to.be.eq(beforeBalanceInvestor.sub(usdValue))
                expect(await d.usdToken.balanceOf(d.multisig.address)).to.be.eq(beforeBalanceBeneficiary.add(usdValue))

                let VestingCreated = getEvent(r, "VestingCreated")
                expect(VestingCreated !== undefined && VestingCreated !== null).to.be.true

                let vesting = await d.seedSale.getVestingByAddressAndIndex(d.investor2Addr, 0)
                expect(vesting.initialized).to.be.true
                expect(vesting.beneficiary).to.be.eq(d.investor2Addr)
                expect(vesting.amountTotal).to.be.eq(engaValue)
                expect(vesting.released).to.be.eq(0)
                expect(vesting.start.toNumber() >= nowTime).to.be.true
                expect(vesting.cliff.toNumber() >= seedSaleConfig.cliffPeroid + nowTime).to.be.true
                expect(vesting.end.toNumber() >= seedSaleConfig.completePeroid + nowTime).to.be.true

                expect(await d.seedSale.getHolderVestingCount(d.investor2Addr)).to.be.eq(1)
            }
        })

        it("should check for the state after the last buy order", async () => {
            let usdValue = (await d.seedSale.daiGoal()).sub(await d.seedSale.totalRaised())
            let engaValue = usdValue.mul(await d.seedSale.getExchangeRate()).div(PPM)

            expect(await d.seedSale.state()).to.be.eq(FundraisingState.Funding)

            // investor 3 vesting 0
            let beforeBalanceInvestor = await d.usdToken.balanceOf(d.investor3Addr)
            let beforeBalanceBeneficiary = await d.usdToken.balanceOf(d.multisig.address)
            let nowTime = await getCurrentNetworkTime()
            await awaitTx(d.usdToken.connect(d.investor3).approve(d.seedSale.address, usdValue))
            let r = await awaitTx(d.seedSale.connect(d.investor3).contribute(usdValue))

            expect(await d.seedSale.state()).to.be.eq(FundraisingState.Closed)

            expect(await d.usdToken.balanceOf(d.investor3Addr)).to.be.eq(beforeBalanceInvestor.sub(usdValue))
            expect(await d.usdToken.balanceOf(d.multisig.address)).to.be.eq(beforeBalanceBeneficiary.add(usdValue))

            let VestingCreated = getEvent(r, "VestingCreated")
            expect(VestingCreated !== undefined && VestingCreated !== null).to.be.true

            let vesting = await d.seedSale.getVestingByAddressAndIndex(d.investor3Addr, 0)
            expect(vesting.initialized).to.be.true
            expect(vesting.beneficiary).to.be.eq(d.investor3Addr)
            expect(vesting.amountTotal).to.be.eq(engaValue)
            expect(vesting.released).to.be.eq(0)
            expect(vesting.start.toNumber() >= nowTime).to.be.true
            expect(vesting.cliff.toNumber() >= seedSaleConfig.cliffPeroid + nowTime).to.be.true
            expect(vesting.end.toNumber() >= seedSaleConfig.completePeroid + nowTime).to.be.true

            expect(await d.seedSale.getHolderVestingCount(d.investor3Addr)).to.be.eq(1)
        })

        it("should not let users to release before cliff time", async () => {
            let nowTime = await getCurrentNetworkTime()
            let vestingId10 = await d.seedSale.computeId(d.investor1Addr, 0)
            let vestingId11 = await d.seedSale.computeId(d.investor1Addr, 1)
            let vestingId20 = await d.seedSale.computeId(d.investor2Addr, 0)
            let vestingId30 = await d.seedSale.computeId(d.investor3Addr, 0)

            expect(nowTime < ((await d.seedSale.getVesting(vestingId10)).cliff.toNumber())).to.be.true
            expect(nowTime < ((await d.seedSale.getVesting(vestingId11)).cliff.toNumber())).to.be.true
            expect(nowTime < ((await d.seedSale.getVesting(vestingId20)).cliff.toNumber())).to.be.true
            expect(nowTime < ((await d.seedSale.getVesting(vestingId30)).cliff.toNumber())).to.be.true

            expect(await isEthException(d.seedSale.release(vestingId10))).to.be.true
            expect(await isEthException(d.seedSale.release(vestingId11))).to.be.true
            expect(await isEthException(d.seedSale.release(vestingId20))).to.be.true
            expect(await isEthException(d.seedSale.release(vestingId30))).to.be.true
        })

        it("should forward the time one month after cliff and let them to release", async () => {
            let nowTime = await getCurrentNetworkTime()
            let forwardTime = (await d.seedSale.getVestingByAddressAndIndex(d.investor3Addr, 0)).cliff.toNumber() + 1 * months
            await waitFor(forwardTime - nowTime)

            let vestingId10 = await d.seedSale.computeId(d.investor1Addr, 0)
            let vestingId11 = await d.seedSale.computeId(d.investor1Addr, 1)
            let vestingId20 = await d.seedSale.computeId(d.investor2Addr, 0)
            let vestingId30 = await d.seedSale.computeId(d.investor3Addr, 0)

            expect(await getCurrentNetworkTime() >= (1 * months + (await d.seedSale.getVesting(vestingId10)).cliff.toNumber())).to.be.true
            expect(await getCurrentNetworkTime() >= (1 * months + (await d.seedSale.getVesting(vestingId11)).cliff.toNumber())).to.be.true
            expect(await getCurrentNetworkTime() >= (1 * months + (await d.seedSale.getVesting(vestingId20)).cliff.toNumber())).to.be.true
            expect(await getCurrentNetworkTime() >= (1 * months + (await d.seedSale.getVesting(vestingId30)).cliff.toNumber())).to.be.true

            let vesting10 = await d.seedSale.getVesting(vestingId10)
            let vesting11 = await d.seedSale.getVesting(vestingId11)
            let vesting20 = await d.seedSale.getVesting(vestingId20)
            let vesting30 = await d.seedSale.getVesting(vestingId30)

            expect(vesting10.released).to.be.eq(0)
            expect(vesting11.released).to.be.eq(0)
            expect(vesting20.released).to.be.eq(0)
            expect(vesting30.released).to.be.eq(0)

            let before1 = await d.engaToken.balanceOf(d.investor1Addr)
            let before2 = await d.engaToken.balanceOf(d.investor2Addr)
            let before3 = await d.engaToken.balanceOf(d.investor3Addr)

            await awaitTx(d.seedSale.release(vestingId10))
            await awaitTx(d.seedSale.release(vestingId11))
            await awaitTx(d.seedSale.release(vestingId20))
            await awaitTx(d.seedSale.release(vestingId30))

            vesting10 = await d.seedSale.getVesting(vestingId10)
            vesting11 = await d.seedSale.getVesting(vestingId11)
            vesting20 = await d.seedSale.getVesting(vestingId20)
            vesting30 = await d.seedSale.getVesting(vestingId30)

            expect(await d.engaToken.balanceOf(d.investor1Addr)).to.be.eq(before1.add(vesting10.released).add(vesting11.released))
            expect(await d.engaToken.balanceOf(d.investor2Addr)).to.be.eq(before2.add(vesting20.released))
            expect(await d.engaToken.balanceOf(d.investor3Addr)).to.be.eq(before3.add(vesting30.released))

            let releasePercent10 = (vesting10.released.mul(100).div(vesting10.amountTotal)).toNumber()
            let timePercent10 = (await getCurrentNetworkTime() - vesting10.cliff.toNumber()) * 100 / (vesting10.end.toNumber() - vesting10.cliff.toNumber())

            let releasePercent11 = (vesting11.released.mul(100).div(vesting11.amountTotal)).toNumber()
            let timePercent11 = (await getCurrentNetworkTime() - vesting11.cliff.toNumber()) * 100 / (vesting11.end.toNumber() - vesting11.cliff.toNumber())

            let releasePercent20 = (vesting20.released.mul(100).div(vesting20.amountTotal)).toNumber()
            let timePercent20 = (await getCurrentNetworkTime() - vesting20.cliff.toNumber()) * 100 / (vesting20.end.toNumber() - vesting20.cliff.toNumber())

            let releasePercent30 = (vesting30.released.mul(100).div(vesting30.amountTotal)).toNumber()
            let timePercent30 = (await getCurrentNetworkTime() - vesting30.cliff.toNumber()) * 100 / (vesting30.end.toNumber() - vesting30.cliff.toNumber())

            expect(releasePercent10 <= timePercent10).to.be.true
            expect(releasePercent11 <= timePercent11).to.be.true
            expect(releasePercent20 <= timePercent20).to.be.true
            expect(releasePercent30 <= timePercent30).to.be.true

            expect(await d.engaToken.balanceOf(d.seedSale.address)).to.be.eq(SEED_SALE_SHARE.sub(vesting10.released).sub(vesting11.released).sub(vesting20.released).sub(vesting30.released))
        })

        it("should release all the funds", async () => {
            let nowTime = await getCurrentNetworkTime()
            let forwardTime = (await d.seedSale.getVestingByAddressAndIndex(d.investor3Addr, 0)).end.toNumber() + 1
            await waitFor(forwardTime - nowTime)

            let vestingId10 = await d.seedSale.computeId(d.investor1Addr, 0)
            let vestingId11 = await d.seedSale.computeId(d.investor1Addr, 1)
            let vestingId20 = await d.seedSale.computeId(d.investor2Addr, 0)
            let vestingId30 = await d.seedSale.computeId(d.investor3Addr, 0)

            expect(await getCurrentNetworkTime() >= (1 + (await d.seedSale.getVesting(vestingId10)).end.toNumber())).to.be.true
            expect(await getCurrentNetworkTime() >= (1 + (await d.seedSale.getVesting(vestingId11)).end.toNumber())).to.be.true
            expect(await getCurrentNetworkTime() >= (1 + (await d.seedSale.getVesting(vestingId20)).end.toNumber())).to.be.true
            expect(await getCurrentNetworkTime() >= (1 + (await d.seedSale.getVesting(vestingId30)).end.toNumber())).to.be.true

            let vesting10 = await d.seedSale.getVesting(vestingId10)
            let vesting11 = await d.seedSale.getVesting(vestingId11)
            let vesting20 = await d.seedSale.getVesting(vestingId20)
            let vesting30 = await d.seedSale.getVesting(vestingId30)

            expect(vesting10.released).to.be.gt(0)
            expect(vesting11.released).to.be.gt(0)
            expect(vesting20.released).to.be.gt(0)
            expect(vesting30.released).to.be.gt(0)

            await awaitTx(d.seedSale.release(vestingId10))
            await awaitTx(d.seedSale.release(vestingId11))
            await awaitTx(d.seedSale.release(vestingId20))
            await awaitTx(d.seedSale.release(vestingId30))

            vesting10 = await d.seedSale.getVesting(vestingId10)
            vesting11 = await d.seedSale.getVesting(vestingId11)
            vesting20 = await d.seedSale.getVesting(vestingId20)
            vesting30 = await d.seedSale.getVesting(vestingId30)

            let releasePercent10 = (vesting10.released.mul(100).div(vesting10.amountTotal)).toNumber()
            let timePercent10 = (await getCurrentNetworkTime() - vesting10.cliff.toNumber()) * 100 / (vesting10.end.toNumber() - vesting10.cliff.toNumber())

            let releasePercent11 = (vesting11.released.mul(100).div(vesting11.amountTotal)).toNumber()
            let timePercent11 = (await getCurrentNetworkTime() - vesting11.cliff.toNumber()) * 100 / (vesting11.end.toNumber() - vesting11.cliff.toNumber())

            let releasePercent20 = (vesting20.released.mul(100).div(vesting20.amountTotal)).toNumber()
            let timePercent20 = (await getCurrentNetworkTime() - vesting20.cliff.toNumber()) * 100 / (vesting20.end.toNumber() - vesting20.cliff.toNumber())

            let releasePercent30 = (vesting30.released.mul(100).div(vesting30.amountTotal)).toNumber()
            let timePercent30 = (await getCurrentNetworkTime() - vesting30.cliff.toNumber()) * 100 / (vesting30.end.toNumber() - vesting30.cliff.toNumber())

            expect(releasePercent10 <= timePercent10).to.be.true
            expect(releasePercent11 <= timePercent11).to.be.true
            expect(releasePercent20 <= timePercent20).to.be.true
            expect(releasePercent30 <= timePercent30).to.be.true

            expect(releasePercent10).to.be.eq(100)
            expect(releasePercent11).to.be.eq(100)
            expect(releasePercent20).to.be.eq(100)
            expect(releasePercent30).to.be.eq(100)

            expect(vesting10.released).to.be.eq(vesting10.amountTotal)
            expect(vesting11.released).to.be.eq(vesting10.amountTotal)
            expect(vesting20.released).to.be.eq(vesting20.amountTotal)
            expect(vesting30.released).to.be.eq(vesting30.amountTotal)

            expect(await d.engaToken.balanceOf(d.seedSale.address)).to.be.eq(SEED_SALE_SHARE.sub(vesting10.released).sub(vesting11.released).sub(vesting20.released).sub(vesting30.released))
        })
    })
})

async function waitFor(time: number) {
    await waitForSomeTimeNetwork(hre.network.provider, time)
}

async function mine(count: number) {
    await mineBlock(hre.network.provider, count)
}

async function getCurrentNetworkTime() {
    return await currentNetworkTime(hre.network.provider)
}

async function currentBlock() {
    return await currentBlockNumber(hre.network.provider)
}

async function mineToNewBatchId() {
    let current = await currentBlock()
    let mod = current.mod(BATCH_BLOCKS)
    let count = BATCH_BLOCKS.sub(mod)
    await mine(Number(count))
}

function execEventArgs(r: ContractReceipt): any {
    return r.events![r.events!.length - 1].args!
}

async function multisigCall(target: string, sig: string, calldata: string) {
    r = await awaitTx(d.multisig.connect(d.owner2).createTransaction(target, 0, sig, calldata, ""))
    let id: BigNumberish = r.events![0].args!.id

    /* const domain = {
        name: "CoreMultisig",
        version: '1',
        chainId: hre.network.config.chainId,
        verifyingContract: multisig.address
    }

    const types = {
        "Transaction" : [
            {name: "id", type: "uint256"},
        ]
    }

    const value = {
        "id" : id
    }
    let owner1Sigend = await owner1._signTypedData(domain, types, value)
    let owner3Sigend = await owner3._signTypedData(domain, types, value)
    let owner4Sigend = await owner4._signTypedData(domain, types, value) */

    const message = ethers.utils.solidityKeccak256(['uint256', 'address', 'uint256'], [hre.network.config.chainId, d.multisig.address, id])

    let owner1Signed = await d.owner1.signMessage(ethers.utils.arrayify(message))
    let owner3Signed = await d.owner3.signMessage(ethers.utils.arrayify(message))
    let owner4Signed = await d.owner4.signMessage(ethers.utils.arrayify(message))

    r = await awaitTx(d.multisig.execute(id, [owner1Signed, owner3Signed, owner4Signed]))
    return { id, r }
}

function getEvent(r: ContractReceipt, eventName: string) {
    let len = r.events!.length
    let e = r.events!

    if (len === 0) return null

    for (let i = 0; i < len; i++) {
        if (e[i].event! === eventName) return e[i]
    }

    return null
}

async function dynamicPricePPM() {
    let engaSupply = await d.engaToken.totalSupply()
    let virtualSupply = (await d.marketMaker.collaterals(d.usdToken.address)).virtualSupply
    let marketMakersSupply = await d.marketMaker.tokensToBeMinted()
    let totalSupply = engaSupply.add(marketMakersSupply).add(virtualSupply)

    let reserveBalance = (await d.reserve.balanceERC20(d.usdToken.address)).sub(await d.tap.getMaximumWithdrawal(d.usdToken.address))
    let virtualBalance = (await d.marketMaker.collaterals(d.usdToken.address)).virtualBalance
    let marketMakerCollateralBalance = await d.marketMaker.collateralsToBeClaimed(d.usdToken.address)
    let totalBalance = (reserveBalance).add(virtualBalance).sub(marketMakerCollateralBalance)

    let rr = mmCollateralConfig.reserveRatioPPM
    return calculatePricePPM(totalSupply, totalBalance, rr)
}

async function getLastVestingId(addr: string) {
    let count = await d.tokenManager.getHolderVestingCount(addr)
    return await d.tokenManager.computeId(addr, count.sub(1))
}

async function openSaleByDate(date: number) {
    let target = d.controller.address
    let sig = 'openSaleByDate(uint256)'
    let calldata = encodeParams(['uint256'], [date])
    let res = await multisigCall(target, sig, calldata)
    return (await d.multisig.transactions(res.id)).executed
}

async function openSaleNow() {
    let target = d.controller.address
    let sig = 'openSaleNow()'
    let calldata = encodeParams([], [])
    let res = await multisigCall(target, sig, calldata)
    return (await d.multisig.transactions(res.id)).executed
}

async function addCollateralToken() {
    let target = d.controller.address
    let sig = 'addCollateralToken(address,uint256,uint256,uint32,uint256,uint256,uint256)'
    let calldata = encodeParams(['address', 'uint256', 'uint256', 'uint32', 'uint256', 'uint256', 'uint256'], [d.usdToken.address, mmCollateralConfig.virtualSupply, mmCollateralConfig.virtualBalance, mmCollateralConfig.reserveRatioPPM, mmCollateralConfig.slippagePCT, tapTokenConfigTest.rate, tapTokenConfigTest.floor])
    let res = await multisigCall(target, sig, calldata)
    return (await d.multisig.transactions(res.id)).executed
}

async function openPublicTrading() {
    let target = d.controller.address
    let sig = 'openPublicTrading(address[])'
    let calldata = encodeParams(['address[]'], [[d.usdToken.address]])
    let res = await multisigCall(target, sig, calldata)
    return (await d.multisig.transactions(res.id)).executed
}

async function withdrawTap() {
    let target = d.controller.address
    let sig = 'withdrawTap(address)'
    let calldata = encodeParams(['address'], [d.usdToken.address])
    let res = await multisigCall(target, sig, calldata)
    return (await d.multisig.transactions(res.id)).executed
}

async function addKycUser(userAddr: string) {
    let target = d.controller.address
    let sig = 'addKycUser(address)'
    let calldata = encodeParams(['address'], [userAddr])
    let res = await multisigCall(target, sig, calldata)
    return (await d.multisig.transactions(res.id)).executed
}

async function removeKycUser(userAddr: string) {
    let target = d.controller.address
    let sig = 'removeKycUser(address)'
    let calldata = encodeParams(['address'], [userAddr])
    let res = await multisigCall(target, sig, calldata)
    return (await d.multisig.transactions(res.id)).executed
}

async function beneficiaryTransfer(token: string, to: string, amount: BigNumberish) {
    let target = d.controller.address
    let sig = 'beneficiaryTransfer(address,address,uint256)'
    let calldata = encodeParams(['address', 'address', 'uint256'], [token, to, amount])
    let res = await multisigCall(target, sig, calldata)
    return (await d.multisig.transactions(res.id)).executed
}

async function release(id: string) {
    let target = d.controller.address
    let sig = 'release(bytes32)'
    let calldata = encodeParams(['bytes32'], [id])
    let res = await multisigCall(target, sig, calldata)
    return (await d.multisig.transactions(res.id)).executed
}