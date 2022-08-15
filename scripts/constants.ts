import { BigNumber } from "ethers"
import { formatEther, fromMonthlyAllocation, log, toEth } from "./utilities"

export const COLLATERALS = {
    rinkeby: '0x95b58a6Bff3D14B7DB2f5cb5F0Ad413DC2940658', // DAI
    ropsten: '0xaD6D458402F60fD3Bd25163575031ACDce07538D', // DAI
    bsc: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // BUSD
    bscTestnet: '0xd0679b2d0cb5fF17Bb729E37c0c785D35398cA60', //MOCK_USD
    polygon: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // DAI
    polygonMumbai: '0x6643F142EEAA078A077a4CFd4fcA1A8ABA332Fa6', // MOCK_USD
    goerli: '0x01Cf32568A9bdcaa6C806E16FaE6D0cb8f052c75' // MOCK_USD
}

export const OWNER_ADDRSS = process.env.OWNERS!.split(' ')
export const OWNER_SHARES = process.env.SHARES!.split(' ').map(share => Number(share))

export const seconds = 1
export const minutes = 60 * seconds
export const hours = 60 * minutes
export const days = 24 * hours
export const weeks = 7 * days
export const months = 30 * days

export const PPM = BigNumber.from(1_000_000)
export const PCT = toEth(1) // 1 * 10 ** 18

export const BATCH_BLOCKS = BigNumber.from(10)

export const SEED_SALE_SHARE = toEth(300_000)
export const MARKETING = toEth(170_000)
export const DAO_SHARE = toEth(1_000_000)
export const TEAM = toEth(1_530_000)
export const STAKE_HOLDERS = toEth(3_000_000)

export const PRE_SALE = toEth(2_000_000)

export const INITIAL_SHARE_SUPPLY = SEED_SALE_SHARE.add(MARKETING).add(DAO_SHARE).add(TEAM).add(STAKE_HOLDERS)
export const INITIAL_SALE_SUPPLY = PRE_SALE
export const INITIAL_SUPPLY = INITIAL_SHARE_SUPPLY.add(INITIAL_SALE_SUPPLY)

export enum FundraisingState {
    Pending,     // presale is idle and pending to be started
    Funding,     // presale has started and contributors can purchase tokens
    Refunding,   // presale has not reached goal within period and contributors can claim refunds
    GoalReached, // presale has reached goal within period and trading is ready to be open
    Closed       // presale has reached goal within period, has been closed and trading has been open
}

export enum ControllerState {
    Constructed,
    ContractsDeployed,
    Initialized
}

/*
let price10Cent = BigNumber.from(100).mul(PPM).div(10) // 0.10$ = (1 / 0.10) * PPM
let price15Cent = BigNumber.from(100).mul(PPM).div(15) // 0.15$ = (1 / 0.15) * PPM
*/

let price = 0.15;
let goal = (price: number, decimals: number = 100) => toEth((Number(formatEther(PRE_SALE)) * (price * decimals)) / decimals)
let rate = (price: number, decimals: number = 100) => BigNumber.from(decimals).mul(PPM).div(price * decimals)

export const seedSaleConfig = {
    daiGoal: toEth(36_000),
    engaGoal: SEED_SALE_SHARE,
    cliffPeroid: 6 * months,
    completePeroid: 12 * months,
    minimumRequiredToken: toEth(100)
}

export const preSaleConfig = {
    goal: goal(price),
    peroid: 1 * months,
    exchangeRate: rate(price),
    cliffPeroid: 6 * months,
    completePeroid: 18 * months,
    beneficiaryPCT: 70 * 10 ** 4, // 70% = 70 * 10 ^ 4, 30% goes into bancor
    minimumRequiredToken: toEth(10)
}

export const marketMakerConfig = {
    buyFeePct: toEth(0.015),  // 1.5% => 0% = 0 * 10 ** 16, 1% = 1 * 10 ** 16, 100% = 100 * 10 ** 16
    sellFeePct: toEth(0.015)  // 1.5% => 0% = 0 * 10 ** 16, 1% = 1 * 10 ** 16, 100% = 100 * 10 ** 16
}

export const tapConfig = {
    maximumTapRateIncreasePct: toEth(1),   //100% => 0% = 0 * 10 ** 16, 1% = 1 * 10 ** 16, 100% = 100 * 10 ** 16
    maximumTapFloorDecreasePct: toEth(0.5) //50%  => 0% = 0 * 10 ** 16, 1% = 1 * 10 ** 16, 100% = 100 * 10 ** 16
}

export const tapTokenConfig = {
    rate: fromMonthlyAllocation(toEth(20_000)), // wei / block
    floor: toEth(20_000) // in wei
}

export const calculateInitialReserveBalance = () => {
    let seedSaleReserveShare = preSaleConfig.goal.sub(preSaleConfig.goal.mul(preSaleConfig.beneficiaryPCT).div(PPM))
    return seedSaleReserveShare
}

const calculateVirtualBalance = (pricePPM: BigNumber, virtualSupply: BigNumber, rr: BigNumber) => {
    let reserveBalance = calculateInitialReserveBalance()

    // price = PPM * balance / (supply * rr) rr is in PPM so we have to multiply our result in 1 PPM
    // balance = virutal balance + initial reserve balance
    // supply = virtual supply + initial supply of the token after all seed and private sale
    let supply = virtualSupply.add(INITIAL_SUPPLY)
    let balance = supply.mul(rr).mul(pricePPM).div(PPM.mul(PPM)) // beacuse passed price is in PPM, we have to divide it on PPM again
    return balance.sub(reserveBalance)
}

export const PUBLIC_SALE_PRICE_PPM = BigNumber.from(25).mul(10000) // 0.25$ = 0.25 * 10 ** 6 => 25 * 10 ** 4
const VIRTUAL_SUPPLY = toEth(10_000_000) // 10M + 5M = 15M
const RESERVE_RATIO_PPM = BigNumber.from(333333)
//const RESERVE_RATIO_PPM = BigNumber.from(777777)
const VIRTUAL_BALANCE = calculateVirtualBalance(PUBLIC_SALE_PRICE_PPM, VIRTUAL_SUPPLY, RESERVE_RATIO_PPM)
const SLIIPPAGE_PCT = toEth(0.1) // 1 PCT = 1 * 10 ** 18, if 1 == 100% then 0.1 == 10%, 0.1 * 10 ** 18 = 1 * 10 ** 17

export const mmCollateralConfig = {
    virtualSupply: VIRTUAL_SUPPLY,
    virtualBalance: VIRTUAL_BALANCE,
    reserveRatioPPM: RESERVE_RATIO_PPM,
    slippagePCT: SLIIPPAGE_PCT,
}

export function calculatePricePPM(supply: BigNumber, balance: BigNumber, rrPPM: BigNumber) {
    return PPM.mul(PPM).mul(balance).div(supply.mul(rrPPM))
}

export function calculatePrice(supply: BigNumber, balance: BigNumber, rrPPM: BigNumber) {
    return Number(calculatePricePPM(supply, balance, rrPPM)) / Number(PPM)
}

log("************")
log("************")
log("INITIAL_SUPPLY: " + formatEther(INITIAL_SUPPLY))
log("************")
log("************")
log("INITILA_SALE_daiGOAL: " + formatEther(seedSaleConfig.daiGoal))
log("INITILA_SALE_engaGOAL: " + formatEther(seedSaleConfig.engaGoal))
log("INITILA_SALE_PRICE: " + (Number((seedSaleConfig.daiGoal.mul(PPM).div(seedSaleConfig.engaGoal))) / Number(PPM)).toFixed(2))
log("************")
log("************")
log("PRE_SALE_GOAL: " + formatEther(preSaleConfig.goal))
log("PRE_SALE_PRICE: " + (Number(PPM) / Number(preSaleConfig.exchangeRate)).toFixed(2))
log("BENEFICIARY_BALANCE: " + formatEther(preSaleConfig.goal.sub(calculateInitialReserveBalance())))
log("RESERVE_BALANCE: " + formatEther(calculateInitialReserveBalance()))
log("************")
log("************")
log("VIRTUAL_SUPPLY: " + formatEther(VIRTUAL_SUPPLY))
log("VIRTUAL_BALANCE: " + formatEther(VIRTUAL_BALANCE))
log("************")
log("************")
log("PRICE PPM: " + calculatePricePPM(INITIAL_SALE_SUPPLY.add(INITIAL_SHARE_SUPPLY).add(VIRTUAL_SUPPLY), VIRTUAL_BALANCE.add(calculateInitialReserveBalance()), RESERVE_RATIO_PPM))
log("PRICE: " + calculatePrice(INITIAL_SUPPLY.add(VIRTUAL_SUPPLY), VIRTUAL_BALANCE.add(calculateInitialReserveBalance()), RESERVE_RATIO_PPM))