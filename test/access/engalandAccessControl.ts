import { expect } from "chai"
import { BigNumberish, ContractReceipt, Signer, Transaction } from "ethers"
import { ethers } from "hardhat"
import { describe } from "mocha"
import { ERC20Mock, MockAccessControl, CoreMultisig } from "../../typechain"
import { awaitTx, encodeParams, isEthException, toEth } from "../../scripts/utilities"
import { CHANGE_DAILY_LIMIT_ROLE, TRANSFER_ROLE } from "../../scripts/offChainKeccakRoles"
import { deployMultisig } from "../../scripts/dep/multisigDeployer"
import hre from "hardhat"

const BENEFICIARY_DAILY_LIMIT = toEth(500)

let usdToken: ERC20Mock

let multisigFirst: CoreMultisig

let multisigSecond: CoreMultisig

let mockAccess: MockAccessControl

let owner1: Signer
let owner2: Signer // owner
let owner3: Signer
let owner4: Signer
let owner5: Signer

let owner2Addr: string
let owner1Addr: string
let owner3Addr: string
let owner4Addr: string
let owner5Addr: string

let receiver: Signer

let receiverAddr: string

// receipt of a transaction
let t: Transaction
let r: ContractReceipt

async function setupUSDMock(beneficiary: string) {
    let TokenFactory = await ethers.getContractFactory("ERC20Mock")
    usdToken = await TokenFactory.deploy("USD", "USD", beneficiary, toEth(100_000_000))
    await usdToken.deployed()
}

async function setupUsers() {
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

    receiver = accounts[5]
    receiverAddr = await receiver.getAddress()
}

async function deployMultisigFirst() {
    multisigFirst = await deployMultisig([owner2Addr, owner1Addr, owner3Addr, owner4Addr, owner5Addr])
}

async function deployMultisigSecond() {
    multisigSecond = await deployMultisig([owner2Addr, owner1Addr, owner3Addr, owner4Addr, owner5Addr])
}

async function setup() {
    console.log("****************")
    console.log("SETUP RUNNING")
    console.log("****************")
    console.log("")

    await setupUsers()
    await deployMultisigFirst()

    let MockAccessTestFactory = await ethers.getContractFactory("MockAccessControl")
    mockAccess = await MockAccessTestFactory.deploy(multisigFirst.address, BENEFICIARY_DAILY_LIMIT, owner1Addr, owner2Addr, owner3Addr, owner4Addr)
    await mockAccess.deployed()

    await setupUSDMock(mockAccess.address)

    console.log("")
    console.log("****************")
    console.log("SETUP ENDED")
    console.log("****************")
}

describe("Engaland Access Control", async () => {
    before(async () => {
        await setup()
    })

    describe("Deployment is successful", async () => {
        it("should check for deployed contract and its initial roles", async () => {
            let admin = await mockAccess.DEFAULT_ADMIN_ROLE()
            let multisig_ = multisigFirst.address
            expect(await mockAccess.hasRole(admin, multisig_)).to.be.true

            expect(await mockAccess.hasRole(TRANSFER_ROLE, multisig_)).to.be.false
            expect(await mockAccess.hasRole(TRANSFER_ROLE, owner1Addr)).to.be.true
            expect(await mockAccess.hasRole(TRANSFER_ROLE, owner2Addr)).to.be.true
            expect(await mockAccess.hasRole(TRANSFER_ROLE, owner3Addr)).to.be.true
            expect(await mockAccess.hasRole(TRANSFER_ROLE, owner3Addr)).to.be.true

            expect(await mockAccess.hasRole(CHANGE_DAILY_LIMIT_ROLE, multisig_)).to.be.false
            expect(await mockAccess.hasRole(CHANGE_DAILY_LIMIT_ROLE, owner1Addr)).to.be.true
            expect(await mockAccess.hasRole(CHANGE_DAILY_LIMIT_ROLE, owner2Addr)).to.be.true
            expect(await mockAccess.hasRole(CHANGE_DAILY_LIMIT_ROLE, owner3Addr)).to.be.false
            expect(await mockAccess.hasRole(CHANGE_DAILY_LIMIT_ROLE, owner4Addr)).to.be.false

            expect(await mockAccess.getRoleAdmin(TRANSFER_ROLE)).to.be.eq(admin)
            expect(await mockAccess.getRoleAdmin(CHANGE_DAILY_LIMIT_ROLE)).to.be.eq(admin)

            expect(await mockAccess.getRoleMemberCount(admin)).to.be.eq(1)
            expect(await mockAccess.getRoleMemberCount(TRANSFER_ROLE)).to.be.eq(4)
            expect(await mockAccess.getRoleMemberCount(CHANGE_DAILY_LIMIT_ROLE)).to.be.eq(2)

            expect(await mockAccess.getRoleMember(TRANSFER_ROLE, 0)).to.be.eq(owner1Addr)
            expect(await mockAccess.getRoleMember(TRANSFER_ROLE, 1)).to.be.eq(owner2Addr)
            expect(await mockAccess.getRoleMember(TRANSFER_ROLE, 2)).to.be.eq(owner3Addr)
            expect(await mockAccess.getRoleMember(TRANSFER_ROLE, 3)).to.be.eq(owner4Addr)

            expect(await mockAccess.getRoleMember(CHANGE_DAILY_LIMIT_ROLE, 0)).to.be.eq(owner1Addr)
            expect(await mockAccess.getRoleMember(CHANGE_DAILY_LIMIT_ROLE, 1)).to.be.eq(owner2Addr)
        })
    })

    describe("Transfering", async () => {
        it("should let core users transfer token to an address", async () => {
            let beforeBalance = await usdToken.balanceOf(receiverAddr)

            await awaitTx(mockAccess.connect(owner2).transferERC20(usdToken.address, receiverAddr, toEth(1_00)))
            expect(await usdToken.balanceOf(receiverAddr)).to.be.eq(beforeBalance.add(toEth(1_00)))
            beforeBalance = await usdToken.balanceOf(receiverAddr)

            await awaitTx(mockAccess.connect(owner1).transferERC20(usdToken.address, receiverAddr, toEth(1_00)))
            expect(await usdToken.balanceOf(receiverAddr)).to.be.eq(beforeBalance.add(toEth(1_00)))
            beforeBalance = await usdToken.balanceOf(receiverAddr)

            await awaitTx(mockAccess.connect(owner3).transferERC20(usdToken.address, receiverAddr, toEth(1_00)))
            expect(await usdToken.balanceOf(receiverAddr)).to.be.eq(beforeBalance.add(toEth(1_00)))
            beforeBalance = await usdToken.balanceOf(receiverAddr)

            await awaitTx(mockAccess.connect(owner4).transferERC20(usdToken.address, receiverAddr, toEth(1_00)))
            expect(await usdToken.balanceOf(receiverAddr)).to.be.eq(beforeBalance.add(toEth(1_00)))
            beforeBalance = await usdToken.balanceOf(receiverAddr)
        })

        it("should let multisig call transfer", async () => {
            let beforeBalance = await usdToken.balanceOf(receiverAddr)
            let dailyLimit = await mockAccess.dailyLimit()

            let { r, id } = await multisigCall(multisigFirst, mockAccess.address, 'transferERC20(address,address,uint256)', encodeParams(['address', 'address', 'uint256'], [usdToken.address, receiverAddr, dailyLimit]))
            expect((await multisigFirst.transactions(id)).executed).to.be.true
            expect(await usdToken.balanceOf(receiverAddr)).to.be.eq(beforeBalance.add(dailyLimit))
            beforeBalance = await usdToken.balanceOf(receiverAddr)
        })
    })

    describe("Add role to new user", async () => {
        it("should not allow users to grant roles to the new user", async () => {
            expect(await isEthException(mockAccess.connect(owner2).grantRole(TRANSFER_ROLE, receiverAddr))).to.be.true
            expect(await isEthException(mockAccess.connect(owner1).grantRole(TRANSFER_ROLE, receiverAddr))).to.be.true
            expect(await isEthException(mockAccess.connect(owner3).grantRole(TRANSFER_ROLE, receiverAddr))).to.be.true
            expect(await isEthException(mockAccess.connect(owner4).grantRole(TRANSFER_ROLE, receiverAddr))).to.be.true

            expect(await mockAccess.hasRole(TRANSFER_ROLE, receiverAddr)).to.be.false
            expect(await isEthException(mockAccess.connect(receiver).transferERC20(usdToken.address, receiverAddr, toEth(1_000)))).to.be.true
        })

        it("should grant roles to the new user with multisig call", async () => {
            let { r, id } = await multisigCall(multisigFirst, mockAccess.address, 'grantRole(bytes32,address)', encodeParams(['bytes32', 'address'], [TRANSFER_ROLE, receiverAddr]))
            expect((await multisigFirst.transactions(id)).executed).to.be.true

            expect(await mockAccess.hasRole(TRANSFER_ROLE, receiverAddr)).to.be.true

            expect(await mockAccess.getRoleMemberCount(TRANSFER_ROLE)).to.be.eq(5)
            expect(await mockAccess.getRoleMember(TRANSFER_ROLE, 4)).to.be.eq(receiverAddr)

            let beforeBalance = await usdToken.balanceOf(receiverAddr)
            await awaitTx(mockAccess.connect(receiver).transferERC20(usdToken.address, receiverAddr, toEth(1_00)))
            expect(await usdToken.balanceOf(receiverAddr)).to.be.eq(beforeBalance.add(toEth(1_00)))
        })

        it("should revoke roles of the new user with multisig call", async () => {
            await multisigCall(multisigFirst, mockAccess.address, 'revokeRole(bytes32,address)', encodeParams(['bytes32', 'address'], [TRANSFER_ROLE, receiverAddr]))

            expect(await mockAccess.getRoleMemberCount(TRANSFER_ROLE)).to.be.eq(4)
            // expect(await isEthException(beneficiary.getRoleMember(TRANSFER_ROLE, 4))).to.be.true

            expect(await mockAccess.hasRole(TRANSFER_ROLE, receiverAddr)).to.be.false
            expect(await isEthException(mockAccess.connect(receiver).transferERC20(usdToken.address, receiverAddr, toEth(1_00)))).to.be.true
        })

        it("should not allow owner3 or owner4 to call dailyLimitToTheMoon", async () => {
            expect(await isEthException(mockAccess.connect(owner3).dailyLimitToTheMoon(BENEFICIARY_DAILY_LIMIT.mul(2)))).to.be.true
            expect(await isEthException(mockAccess.connect(owner4).dailyLimitToTheMoon(BENEFICIARY_DAILY_LIMIT.mul(2)))).to.be.true
        })

        it("should allow owner1 and owner2 to call dailyLimitToTheMoon", async () => {
            await awaitTx(mockAccess.connect(owner1).dailyLimitToTheMoon(BENEFICIARY_DAILY_LIMIT.mul(2)))
            expect(await mockAccess.dailyLimit()).to.be.eq(BENEFICIARY_DAILY_LIMIT.mul(2))

            await awaitTx(mockAccess.connect(owner2).dailyLimitToTheMoon(BENEFICIARY_DAILY_LIMIT.div(2)))
            expect(await mockAccess.dailyLimit()).to.be.eq(BENEFICIARY_DAILY_LIMIT.div(2))
        })

        it("should not allow anyone except multisig to call addNumberToDaily", async () => {
            let formerDailyLimit = await mockAccess.dailyLimit()
            expect(await isEthException(mockAccess.connect(owner1).addNumberToDaily(1))).to.be.true
            expect(await isEthException(mockAccess.connect(owner2).addNumberToDaily(1))).to.be.true
            expect(await isEthException(mockAccess.connect(owner3).addNumberToDaily(1))).to.be.true
            expect(await isEthException(mockAccess.connect(owner4).addNumberToDaily(1))).to.be.true

            expect(await mockAccess.dailyLimit()).to.be.eq(formerDailyLimit)
        })

        it("should allow multisig to call addNumberToDaily", async () => {
            let formerDailyLimit = await mockAccess.dailyLimit()
            let { id } = await multisigCall(multisigFirst, mockAccess.address, 'addNumberToDaily(uint256)', encodeParams(['uint256'], [1]))
            expect((await multisigFirst.transactions(id)).executed).to.be.true

            expect(await mockAccess.dailyLimit()).to.be.eq(formerDailyLimit.add(1))
        })

        it("should not allow users to call grantRole", async () => {
            expect(await isEthException(mockAccess.connect(owner1).grantRole(CHANGE_DAILY_LIMIT_ROLE, owner3Addr))).to.be.true
            expect(await isEthException(mockAccess.connect(owner2).grantRole(CHANGE_DAILY_LIMIT_ROLE, owner3Addr))).to.be.true
        })

        it("should grant role to owner3 with multisig call", async () => {
            expect(await mockAccess.hasRole(CHANGE_DAILY_LIMIT_ROLE, owner3Addr)).to.be.false

            let { id } = await multisigCall(multisigFirst, mockAccess.address, 'grantRole(bytes32,address)', encodeParams(['bytes32', 'address'], [CHANGE_DAILY_LIMIT_ROLE, owner3Addr]))
            expect((await multisigFirst.transactions(id)).executed).to.be.true

            expect(await mockAccess.hasRole(CHANGE_DAILY_LIMIT_ROLE, owner3Addr)).to.be.true
        })

        it("should let owner3 call addNumberToDaily", async () => {
            await awaitTx(mockAccess.connect(owner3).dailyLimitToTheMoon(BENEFICIARY_DAILY_LIMIT.mul(2)))
            expect(await mockAccess.dailyLimit()).to.be.eq(BENEFICIARY_DAILY_LIMIT.mul(2))
        })
    })

    describe("Change Owner", async () => {
        it("should change the ownership and check for the roles before and after changing", async () => {
            await deployMultisigSecond()

            expect(await mockAccess.hasRole(await mockAccess.DEFAULT_ADMIN_ROLE(), multisigFirst.address)).to.be.true
            expect(await mockAccess.hasRole(await mockAccess.DEFAULT_ADMIN_ROLE(), multisigSecond.address)).to.be.false
        })

        it("should not allow other users to call changeOwner", async () => {
            expect(await isEthException(mockAccess.connect(owner2).transferOwnership(multisigSecond.address))).to.be.true
            expect(await isEthException(mockAccess.connect(owner1).transferOwnership(multisigSecond.address))).to.be.true
            expect(await isEthException(mockAccess.connect(owner3).transferOwnership(multisigSecond.address))).to.be.true
            expect(await isEthException(mockAccess.connect(owner4).transferOwnership(multisigSecond.address))).to.be.true
        })

        it("should not allow transferOwnership be called because the passed argument is the old owner itself", async () => {
            let { r, id } = await multisigCall(multisigFirst, mockAccess.address, 'transferOwnership(address)', encodeParams(['address'], [multisigFirst.address]))
            expect((await multisigFirst.transactions(id)).executed).to.be.false
        })

        it("it should change the first multisig to second multisig and check first multisig doesnt have admin role any more", async () => {
            expect(await mockAccess.getRoleMemberCount(await mockAccess.DEFAULT_ADMIN_ROLE())).to.be.eq(1)
            expect(await mockAccess.getRoleMember(await mockAccess.DEFAULT_ADMIN_ROLE(), 0)).to.be.eq(multisigFirst.address)

            let { r, id } = await multisigCall(multisigFirst, mockAccess.address, 'transferOwnership(address)', encodeParams(['address'], [multisigSecond.address]))
            expect((await multisigFirst.transactions(id)).executed).to.be.true

            expect(await mockAccess.getRoleMemberCount(await mockAccess.DEFAULT_ADMIN_ROLE())).to.be.eq(1)
            expect(await mockAccess.getRoleMember(await mockAccess.DEFAULT_ADMIN_ROLE(), 0)).to.be.eq(multisigSecond.address)

            expect(await mockAccess.hasRole(await mockAccess.DEFAULT_ADMIN_ROLE(), multisigFirst.address)).to.be.false
            expect(await mockAccess.hasRole(await mockAccess.DEFAULT_ADMIN_ROLE(), multisigSecond.address)).to.be.true

            {
                let beforeBalance = await usdToken.balanceOf(receiverAddr)
                let { r, id } = await multisigCall(multisigSecond, mockAccess.address, 'transferERC20(address,address,uint256)', encodeParams(['address', 'address', 'uint256'], [usdToken.address, receiverAddr, toEth(1_000)]))

                expect((await multisigSecond.transactions(id)).executed).to.be.true
                expect(await usdToken.balanceOf(receiverAddr)).to.be.eq(beforeBalance.add(toEth(1_000)))
            }

            {
                let beforeBalance = await usdToken.balanceOf(receiverAddr)
                let { r, id } = await multisigCall(multisigFirst, mockAccess.address, 'transferERC20(address,address,uint256)', encodeParams(['address', 'address', 'uint256'], [usdToken.address, receiverAddr, toEth(1_000)]))

                expect((await multisigFirst.transactions(id)).executed).to.be.false
                expect(await usdToken.balanceOf(receiverAddr)).to.be.eq(beforeBalance)
            }
        })
    })
})

async function multisigCall(multisig: CoreMultisig, target: string, sig: string, calldata: string) {
    r = await awaitTx(multisig.createTransaction(target, 0, sig, calldata, ""))
    let id: BigNumberish = r.events![0].args!.id

    const message = ethers.utils.solidityKeccak256(['uint256', 'address', 'uint256'], [hre.network.config.chainId, multisig.address, id])

    let owner1Sigend = await owner1.signMessage(ethers.utils.arrayify(message))
    let owner2Sigend = await owner2.signMessage(ethers.utils.arrayify(message))
    let owner3Sigend = await owner3.signMessage(ethers.utils.arrayify(message))
    let owner4Sigend = await owner4.signMessage(ethers.utils.arrayify(message))

    r = await awaitTx(multisig.execute(id, [owner1Sigend, owner2Sigend, owner3Sigend, owner4Sigend]))
    return { id, r }
}