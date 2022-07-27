import path from "path";
import fs from 'fs';

export function getSavedContractAddresses() {
    let json: any = '{}';
    try {
        json = fs.readFileSync(path.join(__dirname, `../deploy/contract-addresses.json`));
    } finally {
        return JSON.parse(json);
    }
}

export function saveContractAddress(network: string, contract: string, address: string, blockNumber: number, blockHash: string, txHash: string) {
    const addrs = getSavedContractAddresses();
    addrs[network] = addrs[network] || {};

    addrs[network][contract] = { address, blockNumber, blockHash, txHash };

    fs.writeFileSync(path.join(__dirname, `../deploy/contract-addresses.json`), JSON.stringify(addrs, null, '    '));
}

export function getSavedPrecomputedContractAddresses() {
    let json: any = '{}';
    try {
        json = fs.readFileSync(path.join(__dirname, `../deploy/contract-precomputed-addresses.json`));
    } finally {
        return JSON.parse(json);
    }
}

export function savePrecomputedContractAddress(network: string, contract: string, address: string) {
    const addrs = getSavedPrecomputedContractAddresses();
    addrs[network] = addrs[network] || {};
    addrs[network][contract] = address;
    fs.writeFileSync(path.join(__dirname, `../deploy/contract-precomputed-addresses.json`), JSON.stringify(addrs, null, '    '));
}

export function getSavedContractABI() {
    let json: any = '{}';
    try {
        json = fs.readFileSync(path.join(__dirname, `../deploy/contract-abis.json`));
    } finally {
        return JSON.parse(json);
    }
}

export function saveContractAbi(network: string, contract: string, abi: string | string[]) {
    const abis = getSavedContractABI();
    abis[network] = abis[network] || {};
    abis[network][contract] = abi;
    fs.writeFileSync(path.join(__dirname, `../deploy/contract-abis.json`), JSON.stringify(abis, null, '    '));
}