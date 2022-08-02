import { BaseContract, BigNumberish, Signer } from "ethers";
import { FormatTypes } from "ethers/lib/utils";
import { saveContractAbi, saveContractAddress } from "../fileUtils";
import { awaitTx, isDeployed } from "../utilities";
import hre, { ethers } from "hardhat"
import { CoreMultisig } from "../../typechain";

export function isNetworkDeployable(networkName: string): boolean {
    let res = networkName !== 'hardhat' && networkName !== 'localhost'
    if (res === false)
        console.error("ERROR: Network is not deployable, please pass --network [networkname] to the command-line")
    return res
}

export function isNetworkRegistered(contracts: any, networkName: string): boolean {
    if (contracts === undefined || contracts === null) {
        console.error("ERROR: No contracts file found")
        return false
    }

    let res = contracts[networkName] !== null && contracts[networkName] !== undefined
    if (res == false)
        console.error("ERROR: No contract has been registered yet on the network: " + networkName)
    return res
}

export function isContractRegistered(contracts: any, networkName: string, contractName: string): boolean {
    if (isNetworkDeployable(networkName) === false) return false
    if (isNetworkRegistered(contracts, networkName) === false) return false

    let res = contracts[networkName][contractName] !== null && contracts[networkName][contractName] !== undefined
    if (res == false)
        console.error(`ERROR: Contract ${contractName} has not been registered yet on the network: ${networkName}`)
    return res
}

export async function isContractRegisteredAndDeployed(contracts: any, networkName: string, contractName: string): Promise<boolean> {
    if (isContractRegistered(contracts, networkName, contractName) === false) return false

    let res = await isDeployed(hre, contracts[networkName][contractName].address)
    if (res == false)
        console.error(`ERROR: Contract ${contractName} has been registered but not been deployed yet on the network: ${networkName}`)
    return res
}

export async function isContractDeployed(contracts: any, networkName: string, contractName: string): Promise<boolean> {
    if (isNetworkDeployable(networkName) === false) return false
    if (isNetworkRegistered(contracts, networkName) === false) return false

    let res = await isDeployed(hre, contracts[networkName][contractName].address)
    if (res == false)
        console.error(`ERROR: Contract ${contractName} has not been deployed yet on the network: ${networkName}`)
    return res
}

export async function isGnosisSafeDeployed(contracts: any, networkName: string): Promise<boolean> {
    let res = await isContractRegisteredAndDeployed(contracts, networkName, 'GnosisSafe')
    if (res === false)
        console.error("ERROR: GnosisSafe is not deployed yet, please head over to https://gnosis-safe.io/app/welcome and create one")
    return res
}

export async function isCoreMultisigDeployed(contracts: any, networkName: string): Promise<boolean> {
    let res = await isContractRegisteredAndDeployed(contracts, networkName, 'CoreMultisig')
    if (res === false)
        console.error("ERROR: CoreMultisig is not deployed yet, please call scripts/dep/1_multisig.ts to deploy it")
    return res
}

export async function isSeedSaleDeployed(contracts: any, networkName: string): Promise<boolean> {
    let res = await isContractRegisteredAndDeployed(contracts, networkName, 'SeedSale')
    if (res === false)
        console.error("ERROR: SeedSale is not deployed yet, please call scripts/dep/2_seedSale.ts to deploy it")
    return res
}

export async function isStakeHoldersDeployed(contracts: any, networkName: string): Promise<boolean> {
    let res = await isContractRegisteredAndDeployed(contracts, networkName, 'StakeHolders')
    if (res === false)
        console.error("ERROR: StakeHolders is not deployed yet, please call scripts/dep/3_StakeHolders.ts to deploy it")
    return res
}

export async function canCoreMultisigBeDeployed(contracts: any, networkName: string): Promise<boolean> {
    if (networkName !== 'hardhat' && networkName !== 'localhost') {
        if (contracts[networkName] !== null && contracts[networkName] !== undefined) {
            if (contracts[networkName]['CoreMultisig'] !== null && contracts[networkName]['CoreMultisig'] !== undefined)
                if (await isDeployed(hre, contracts[networkName]['CoreMultisig'].address)) {
                    console.error("ERROR: CoreMultisig is already deployed, please remove it from the database file first at deploy/contract-addresses.json")
                    return false
                }
        }
    }

    return true
}

export async function saveContractInFile(networkName: string, name: string, contract: BaseContract) {
    if (networkName === 'hardhat' || networkName === 'localhost') return
    let receipt = await contract.deployTransaction.wait(1)

    saveContractAddress(networkName, name, contract.address, receipt.blockNumber, receipt.blockHash, receipt.transactionHash)
    saveContractAbi(networkName, name, contract.interface.format(FormatTypes.json))
}

export async function createTransaction(multisig: CoreMultisig, signer: Signer, target: string, sig: string, calldata: string, value: BigNumberish = 0, desc: string = "") {
    let result = await awaitTx(multisig.connect(signer).createTransaction(target, value, sig, calldata, desc))
    let id: BigNumberish = result.events![0].args!.id
    const message = ethers.utils.solidityKeccak256(['uint256', 'address', 'uint256'], [hre.network.config.chainId, multisig.address, id])
    return { id, message }
}

export async function signMessage(signer: Signer, message: string) {
    return await signer.signMessage(ethers.utils.arrayify(message))
}