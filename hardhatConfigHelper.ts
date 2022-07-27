export let tokens = {
    ETH: {
        token: 'ETH',
        api: 'https://api.etherscan.io/api?module=proxy&action=eth_gasPrice'
    },
    BNB: {
        token: 'BNB',
        api: 'https://api.bscscan.com/api?module=proxy&action=eth_gasPrice'
    },
    MATIC: {
        token: 'MATIC',
        api: 'https://api.polygonscan.com/api?module=proxy&action=eth_gasPrice'
    },
    AVAX: {
        token: 'AVAX',
        api: 'https://api.snowtrace.io/api?module=proxy&action=eth_gasPrice'
    }
}

export function parseBool(value?: string) {
    if (value === null || value === undefined)
        return false
    if (typeof value === "string") {
        value = value.toLowerCase();
        if (value === "true" || value === "false") {
            return value === "true";
        }
    }
    return false
}