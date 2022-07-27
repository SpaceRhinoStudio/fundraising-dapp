# engaland-fundraising-dapp

This project is using [aragon.org](https://aragon.org)'s Market Maker, Tap Mechanism and Bancor Formula. In our repositry contracts/fundraising/Controller is the owner of contracts defined in contracts/fundraising. Tokens will initially be distributed to seed sale, beneficiary vault and treasury vault which have their own specific access control. You can read more about our tokenomic [here](https://docs.enga.land/tokenomic-land/tokenomics).

## Dependencies
For saving our private key safely, we are using GnuPG



To decrypt our gpg file from command-line, we are using [node-gpg-ts](https://github.com/sdedovic/node-gpg-ts)



To pass env varaibles and to be able to decrypt gpg asynchronously in the same terminal stream we are using [env-cmd](https://www.npmjs.com/package/env-cmd)



Other dependencies are related to hardhat, you can read more about hardhat [here](https://hardhat.org/).



## Before Deployment
Please make a file named **keyStore.json** in json format as below and encrypt it by gpg (command-line or windows app) in the root directory of the project
```
// keyStore.json.gpg
{
  'key': 'YOUR_PRIVATE_KEY'
}
```

All yarn commands are self explanatory, if you have any question or suggestion, please contact me at alexmettkov@gmail.com or @Mehdikovic on twitter.

## Setup env
Make a **.env** file, put these environment variables and fill them with your own subscriptions and configs, then you good to start deploying.



If you want to check the gas usage of the contracts, just set ***COINMARKET_API*** and set ***REPORT_GAS = true***, finally run ```yarn test```.



*We are using alchemy for ***MUMBAI_URL*** and ***RINKEBY_URL*** which let us deploy our contracts on them.*



*Head over to [coinmarketcap](https://coinmarketcap.com/) and sign up to get your free api.*



*You can sign up in any network explorer and recieve your free scan_api. To verify our contracts we need those ***SCAN_API_KEY*** based on the network that contracts are deployed.*



```
MUMBAI_URL = 
RINKEBY_URL = 
COINMARKET_API = 
REPORT_GAS = [false/true]

BSCSCAN_API_KEY = 
POLYGONSCAN_API_KEY = 
RINKEBYSCAN_API_KEY = 

[only if you are using node v17.5.0 on windows]
NODE_OPTIONS = --openssl-legacy-provider
```
