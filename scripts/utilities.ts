import { ContractReceipt, ContractTransaction } from "ethers"
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { formatFixed, parseFixed } from "@ethersproject/bignumber";
import { ParamType } from "ethers/lib/utils"
import { ethers, web3 } from "hardhat"
import { EthereumProvider, HardhatRuntimeEnvironment } from "hardhat/types"

/*
60 seconds / 3 seconds = 20; 3 seconds is the time between the blocks generated on chain
*/
export const BLOCKS_PER_MINUTE = 20;

export const unitNames = [
    "wei",
    "kwei",
    "mwei",
    "gwei",
    "szabo",
    "finney",
    "ether",
];

export function calculateSyntheticShare(length: number) {
    let shares = []
    for (let i = 0; i < length; i++)
        shares.push(100 / length)
    return shares
}

export function log(o: any) {
    console.log(o)
}

export async function awaitTx(tx: Promise<ContractTransaction>): Promise<ContractReceipt> {
    return (await tx).wait()
}

export async function isEthException(promise: Promise<any>): Promise<boolean> {
    let msg = 'No Exception'
    try {
        await promise;
    } catch (e: any) {
        msg = e.message
    }
    return (
        msg.includes('Transaction reverted') ||
        msg.includes('VM Exception while processing transaction: revert') ||
        msg.includes('invalid opcode') ||
        msg.includes('exited with an error (status 0)')
    )
}

export function isThrownError(func: Function): boolean {
    let hasError = false
    try {
        func()
    } catch (e: any) {
        hasError = true
    }
    return hasError
}

export const getTimeNow = () => Math.floor(new Date().getTime() / 1000);

export const getTime = (year: number, month: number, day?: number | undefined, hour?: number | undefined, minute?: number | undefined, second?: number | undefined) => {
    day = day === undefined ? 1 : day;
    hour = hour === undefined ? 0 : hour;
    minute = minute === undefined ? 0 : minute;
    second = second === undefined ? 0 : second;
    return Math.floor(new Date(year, month, day, hour, minute, second).getTime() / 1000)
};

export function hexName(name: string) {
    let hexed = web3.utils.toHex(name);
    let prefix = '0x';
    let hexValue = hexed.slice(2);

    while (hexValue.length < 64) {
        hexValue = '0' + hexValue
    }
    return prefix.concat(hexValue);
}

export function hexify(names: string[]) {
    let resp = [];

    for (const name of names) {
        resp.push(hexName(name));
    }
    return resp;
}

export function encodeParams(types: readonly (string | ParamType)[], values: readonly any[]): string {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

export function decodeParams(data: string, types: readonly (string | ParamType)[]) {
    const abi = new ethers.utils.AbiCoder();
    return abi.decode(types, data);
}

export function arrayIsEqual(arr1: any[], arr2: any[]) {
    return JSON.stringify(arr1) == JSON.stringify(arr2)
}

export async function waitForSomeTimeNetwork(provider: EthereumProvider, seconds: Number) {
    await provider.send("evm_increaseTime", [seconds]);
    await provider.send("evm_mine");
}

export async function mineBlock(provider: EthereumProvider, count: Number) {
    for (let i = 0; i < count; i++) {
        await provider.send("evm_mine");
    }
}

export async function currentNetworkTime(provider: EthereumProvider) {
    const block = await provider.send('eth_getBlockByNumber', ['latest', false])
    return parseInt(block.timestamp, 16)
}

export async function currentBlockNumber(provider: EthereumProvider) {
    const block = await provider.send('eth_getBlockByNumber', ['latest', false])
    return BigNumber.from(block.number)
}

export function formatUnits(value: BigNumberish, unitName?: string | BigNumberish): string {
    if (typeof (unitName) === "string") {
        const index = unitNames.indexOf(unitName);
        if (index !== -1) { unitName = 3 * index; }
    }
    return formatFixed(value, (unitName != null) ? unitName : 18);
}

export function parseUnits(value: string, unitName?: BigNumberish): BigNumber {
    if (typeof (value) !== "string") {
        console.error("value must be a string", "value", value);
    }
    if (typeof (unitName) === "string") {
        const index = unitNames.indexOf(unitName);
        if (index !== -1) { unitName = 3 * index; }
    }
    return parseFixed(value, (unitName != null) ? unitName : 18);
}

export function toEth(value: BigNumberish) {
    return ethers.utils.parseEther(value.toString());
}

export function formatEther(wei: BigNumberish): string {
    return formatUnits(wei, 18);
}

export function parseEther(ether: string): BigNumber {
    return parseUnits(ether, 18);
}

// Converts a tap rate to its monthly rate
export const toMonthlyAllocation = (value: BigNumberish) => {
    return BigNumber.from(value).mul(BLOCKS_PER_MINUTE * 60 * 24 * 30);
}

// Converts a monthly rate to its tap rate (wei/block) [blocksPerMinute, minutes, hours, days]
export const fromMonthlyAllocation = (value: BigNumberish) => {
    return BigNumber.from(value).div(BLOCKS_PER_MINUTE * 60 * 24 * 30);
}

export async function isDeployed(hre: HardhatRuntimeEnvironment, address: string) {
    if (address === undefined || address === null) return false

    const code = await hre.ethers.provider.getCode(address)
    return code.slice(2).length > 0
}

export const numberToUint256 = (value: number) => {
    const hex = value.toString(16)
    return `0x${'0'.repeat(64 - hex.length)}${hex}`
}
