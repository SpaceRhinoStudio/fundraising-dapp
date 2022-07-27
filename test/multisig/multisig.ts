import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { BigNumberish, ContractReceipt } from "ethers"
import { ethers } from "hardhat"
import { CoreMultisig } from "../../typechain"
import hre from "hardhat"

import { encodeParams, isEthException, awaitTx, decodeParams, arrayIsEqual } from "../../scripts/utilities"
import { deployMultisig } from "../../scripts/dep/multisigDeployer"
import { BYTES32_ZERO, TRANSFER_ROLE } from "../../scripts/offChainKeccakRoles"

// accounts
let owner: SignerWithAddress, ownerAddr: string
let core1: SignerWithAddress, core2: SignerWithAddress, core3: SignerWithAddress, core4: SignerWithAddress
let core1Addr: string, core2Addr: string, core3Addr: string, core4Addr: string
let intruder1: SignerWithAddress, intruder1Addr: string
let intruder2: SignerWithAddress, intruder2Addr: string
let intruder3: SignerWithAddress, intruder3Addr: string
let candidate: SignerWithAddress, candidateAddr: string
let secondCandidate: SignerWithAddress, secondCandidateAddr: string

// contracts
let multisig: CoreMultisig

//initial members, initialnames
let initialMembers: string[]

// receipt of a transaction
let r: ContractReceipt
let id: BigNumberish

let target: string
let sig: string
let calldata: string

async function setup() {
  console.log("****************")
  console.log("SETUP RUNNING")
  console.log("****************")
  console.log("")

  let accounts = await ethers.getSigners()
  owner = accounts[0]
  ownerAddr = await owner.getAddress()

  core1 = accounts[1]
  core1Addr = await core1.getAddress()
  core2 = accounts[2]
  core2Addr = await core2.getAddress()
  core3 = accounts[3]
  core3Addr = await core3.getAddress()
  core4 = accounts[4]
  core4Addr = await core4.getAddress()

  intruder1 = accounts[10]
  intruder1Addr = await intruder1.getAddress()

  intruder2 = accounts[11]
  intruder2Addr = await intruder2.getAddress()

  intruder3 = accounts[12]
  intruder3Addr = await intruder3.getAddress()

  candidate = accounts[13]
  candidateAddr = await candidate.getAddress()

  secondCandidate = accounts[14]
  secondCandidateAddr = await secondCandidate.getAddress()

  initialMembers = [ownerAddr, core1Addr, core2Addr, core3Addr, core4Addr]

  multisig = await deployMultisig([ownerAddr, core1Addr, core2Addr, core3Addr, core4Addr])

  console.log("")
  console.log("****************")
  console.log("SETUP ENDED")
  console.log("****************")
}

describe("CoreMultisig", async () => {
  before(async () => {
    await setup()
  })

  describe("FederationMemberRegistry::setup", async () => {
    it("should check for the permissions", async () => {
      let DEFAULT_ADMIN_ROLE = BYTES32_ZERO

      expect(await multisig.TRANSFER_ROLE()).to.be.eq(TRANSFER_ROLE)
      expect(await multisig.hasRole(DEFAULT_ADMIN_ROLE, multisig.address)).to.be.true
      expect(await multisig.hasRole(TRANSFER_ROLE, multisig.address)).to.be.true
    })

    it("should contains 5 initial core members", async () => {
      expect(await multisig.getNumberOfMembers()).to.be.eq(5)

      expect(await multisig.members(0)).to.eq(ownerAddr)
      expect(await multisig.members(1)).to.eq(core1Addr)
      expect(await multisig.members(2)).to.eq(core2Addr)
      expect(await multisig.members(3)).to.eq(core3Addr)
      expect(await multisig.members(4)).to.eq(core4Addr)

      expect(await multisig.isMember(core3Addr)).to.be.true
      expect(await multisig.isMember(intruder1Addr)).to.be.false
    })

    it("should check addresses and names", async () => {
      let allMembers = await multisig.getAllMemberAddresses()
      for (let i = 0; i < allMembers.length; i++) {
        expect(initialMembers[i].toLowerCase()).to.be.eq(allMembers[i].toLowerCase())
      }
    })

    it("should return member info with his/her address", async () => {
      let memberInfo = await multisig.getMemberInfo(ownerAddr)
      let addr2Member = await multisig.addr2Member(ownerAddr)

      expect(memberInfo.index.toNumber() === 0).to.be.true // name
      expect(addr2Member.index.toNumber() === 0).to.be.true // name
    })

    it("should check initial addresses of other contracts passed to its constructor", async () => {
      expect(await multisig.owner()).to.be.eq(multisig.address)
    })
  })

  describe("Transactions system is ready to work here::procees", async () => {

    describe("Lets begin with adding and removing new core member::procees", async () => {

      it("should fail if any member other than core propose", async () => {
        target = multisig.address
        sig = 'addCoreMember(address)'
        calldata = encodeParams(['address'], [intruder1Addr])

        expect(await isEthException(multisig.connect(intruder1)
          .createTransaction(target, "0", sig, calldata, ""))
        ).to.be.true

        calldata = encodeParams(['address'], [candidateAddr])

        expect(await isEthException(multisig.connect(candidate)
          .createTransaction(target, "0", sig, calldata, ""))
        ).to.be.true
      })

      it("should pass if any member proposes and catch the event", async () => {
        target = multisig.address
        sig = 'addMember(address)'
        calldata = encodeParams(['address'], [candidateAddr])

        r = await awaitTx(multisig.connect(owner)
          .createTransaction(target, "0", sig, calldata, "AAA")
        )

        id = r.events![0].args!.id
        expect(r.events!.length).to.be.eq(1)
        expect(r.events![0].event).to.be.eq("TransactionCreated")
        expect(r.events![0].args!.sender).to.be.eq(ownerAddr)
        expect(r.events![0].args!.target).to.be.eq(target)
        expect(r.events![0].args!.signature).to.be.eq(sig)
        expect(r.events![0].args!.description).to.be.eq("AAA")
      })

      it("should check the integrity of incrementing id", async () => {
        let transactionCount = await multisig.transactionCount()
        expect(transactionCount).to.be.eq(id)
      })

      it("should not allow council or other members be able to cast vote on a core transaction", async () => {
        const message = ethers.utils.solidityKeccak256(['uint256', 'address', 'uint256'], [hre.network.config.chainId, multisig.address, id])

        let signed1 = await intruder1.signMessage(ethers.utils.arrayify(message))
        let signed2 = await intruder2.signMessage(ethers.utils.arrayify(message))
        let signed3 = await intruder3.signMessage(ethers.utils.arrayify(message))

        expect(await isEthException(multisig.execute(id, [signed1, signed2, signed3]))).to.be.true
      })

      it("should not allow other members to run execute", async () => {
        const message = ethers.utils.solidityKeccak256(['uint256', 'address', 'uint256'], [hre.network.config.chainId, multisig.address, id])
        let signed1 = await core1.signMessage(ethers.utils.arrayify(message))
        let signed2 = await core2.signMessage(ethers.utils.arrayify(message))
        let signed3 = await core3.signMessage(ethers.utils.arrayify(message))

        expect(await isEthException(multisig.connect(candidate).execute(id, [signed1, signed2, signed3]))).to.be.true
        expect(await isEthException(multisig.connect(intruder1).execute(id, [signed1, signed2, signed3]))).to.be.true
        expect(await isEthException(multisig.connect(intruder2).execute(id, [signed1, signed2, signed3]))).to.be.true
      })

      it("should not run execute because quorum is not reached", async () => {
        const message = ethers.utils.solidityKeccak256(['uint256', 'address', 'uint256'], [hre.network.config.chainId, multisig.address, id])

        let signed1 = await core1.signMessage(ethers.utils.arrayify(message))

        expect(await isEthException(multisig.execute(id, [signed1]))).to.be.true
      })

      it("should run execute because when required messages have been signed off-line", async () => {
        const message = ethers.utils.solidityKeccak256(['uint256', 'address', 'uint256'], [hre.network.config.chainId, multisig.address, id])

        let signed1 = await core1.signMessage(ethers.utils.arrayify(message))
        let signed2 = await core2.signMessage(ethers.utils.arrayify(message))
        let signed3 = await core3.signMessage(ethers.utils.arrayify(message))

        r = await awaitTx(multisig.execute(id, [signed1, signed2, signed3]))
        let tr = await multisig.transactions(id)
        expect(tr.executed).to.be.true
        expect(tr.canceled).to.be.false
      })

      it("should contain two events from previous transaction, adding a new core member and running a Transaction by multisig", async () => {
        expect(r.events!.length).to.be.eq(2) // MembershipChanged, TransactionExecuted

        // NOTE: r.events![0].address === memberReg.address

        expect(r.events![1].event).to.be.eq("TransactionExecuted")
        expect(r.events![1].args!.target).to.be.eq(target)
        expect(r.events![1].args!.id).to.be.eq(id)
        expect(r.events![1].args!.value).to.be.eq(0)
        expect(r.events![1].args!.signature).to.be.eq(sig)
        expect(r.events![1].args!.calldatas).to.be.eq(calldata)

        expect(r.events![1].args!.calldatas).to.be.eq(encodeParams(['address'], [candidateAddr]))
        expect(
          arrayIsEqual(decodeParams(calldata, ['address']).concat(), [candidateAddr])
        ).to.be.true
      })

      it("should now have 6 core members", async () => {
        expect(await multisig.isMember(candidateAddr)).to.be.true
        expect((await multisig.getAllMemberAddresses()).length).to.be.eq(6)
      })

      it("should verify members' addresses", async () => {
        let members = await multisig.getAllMemberAddresses()
        expect(members[0]).is.eq(ownerAddr)
        expect(members[1]).is.eq(core1Addr)
        expect(members[2]).is.eq(core2Addr)
        expect(members[3]).is.eq(core3Addr)
        expect(members[4]).is.eq(core4Addr)
        expect(members[5]).is.eq(candidateAddr)
      })

      it("should verify new quorum", async () => {
        expect(await multisig.getQuorum()).to.be.eq(4)
      })

      it("should create another transaction to remove the new member", async () => {
        target = multisig.address
        sig = 'removeMember(address)'
        calldata = encodeParams(['address'], [candidateAddr])

        r = await awaitTx(multisig.connect(candidate).createTransaction(target, 0, sig, calldata, "delete myself"))
        id = r.events?.[0].args?.id
        expect(id).to.be.eq(2)
        expect(r.events?.length).to.be.eq(1)
        expect(r.events?.[0].event).to.be.eq("TransactionCreated")

        expect(await multisig.transactionCount()).to.be.eq(2)

        const message = ethers.utils.solidityKeccak256(['uint256', 'address', 'uint256'], [hre.network.config.chainId, multisig.address, id])

        let signed1 = await core1.signMessage(ethers.utils.arrayify(message))
        let signed2 = await core2.signMessage(ethers.utils.arrayify(message))
        let signed3 = await core3.signMessage(ethers.utils.arrayify(message))
        let signed4 = await core4.signMessage(ethers.utils.arrayify(message))

        expect(await isEthException(multisig.connect(core1).execute(id, [signed1, signed2, signed3, signed3]))).to.be.true

        r = await awaitTx(multisig.connect(core1).execute(id, [signed1, signed2, signed3, signed4]))
        expect((await multisig.transactions(id)).executed).to.be.true

        expect(await multisig.isMember(candidateAddr)).to.be.false
        expect((await multisig.getAllMemberAddresses()).length).to.be.eq(5)
        expect(await multisig.getQuorum()).to.be.eq(3)

        expect(await isEthException(multisig.connect(core1).execute(id, [signed1, signed2, signed3]))).to.be.true
      })

      it("should be able to cancel the Transaction proposal anytime", async () => {
        target = multisig.address
        sig = 'addMember(address)'
        calldata = encodeParams(['address'], [candidateAddr])

        r = await awaitTx(multisig.connect(owner)
          .createTransaction(target, "0", sig, calldata, "AAA")
        )
        id = r.events?.[0].args?.id

        r = await awaitTx(multisig.connect(owner).cancel(id))
        expect(r.events!.length).to.be.eq(1)
        expect(r.events![0].args!.transactionId).to.be.eq(id)

        expect((await multisig.transactions(id)).canceled).to.be.true
        expect((await multisig.transactions(id)).executed).to.be.false
      })

      it("should not allow to execute canceled transaction", async () => {
        const message = ethers.utils.solidityKeccak256(['uint256', 'address', 'uint256'], [hre.network.config.chainId, multisig.address, id])

        let signed1 = await core1.signMessage(ethers.utils.arrayify(message))
        let signed2 = await core2.signMessage(ethers.utils.arrayify(message))
        let signed3 = await core3.signMessage(ethers.utils.arrayify(message))
        let signed4 = await core4.signMessage(ethers.utils.arrayify(message))

        expect(await isEthException(multisig.connect(core1).execute(id, [signed1, signed2, signed3, signed4]))).to.be.true
      })

      it("should execute multiple transactions", async () => {
        target = multisig.address
        sig = 'addMember(address)'
        let calldata1 = encodeParams(['address'], [candidateAddr])
        let calldata2 = encodeParams(['address'], [secondCandidateAddr])

        let r1 = await awaitTx(multisig.connect(owner)
          .createTransaction(target, "0", sig, calldata1, "AAA")
        )
        let id1 = r1.events![0].args!.id

        let r2 = await awaitTx(multisig.connect(owner)
          .createTransaction(target, "0", sig, calldata2, "AAA")
        )
        let id2 = r2.events![0].args!.id

        const message1 = ethers.utils.solidityKeccak256(['uint256', 'address', 'uint256'], [hre.network.config.chainId, multisig.address, id1])
        const message2 = ethers.utils.solidityKeccak256(['uint256', 'address', 'uint256'], [hre.network.config.chainId, multisig.address, id2])

        let signed1_1 = await core1.signMessage(ethers.utils.arrayify(message1))
        let signed1_2 = await core2.signMessage(ethers.utils.arrayify(message1))
        let signed1_3 = await core3.signMessage(ethers.utils.arrayify(message1))

        let signed2_1 = await core1.signMessage(ethers.utils.arrayify(message2))
        let signed2_2 = await core2.signMessage(ethers.utils.arrayify(message2))
        let signed2_3 = await core3.signMessage(ethers.utils.arrayify(message2))
        let signed2_4 = await candidate.signMessage(ethers.utils.arrayify(message2))

        expect(await multisig.isMember(candidateAddr)).to.be.false
        expect(await multisig.isMember(secondCandidateAddr)).to.be.false

        expect(await multisig.getQuorum()).to.be.eq(3)
        expect((await multisig.getAllMemberAddresses()).length).to.be.eq(5)

        await awaitTx(multisig.executeAll([id1, id2], [[signed1_1, signed1_2, signed1_3], [signed2_1, signed2_2, signed2_3, signed2_4]]))

        let tr1 = await multisig.transactions(id1)
        expect(tr1.executed).to.be.true
        expect(tr1.canceled).to.be.false

        let tr2 = await multisig.transactions(id2)
        expect(tr2.executed).to.be.true
        expect(tr2.canceled).to.be.false

        expect(await multisig.isMember(candidateAddr)).to.be.true
        expect(await multisig.isMember(secondCandidateAddr)).to.be.true

        expect(await multisig.getQuorum()).to.be.eq(4)
        expect((await multisig.getAllMemberAddresses()).length).to.be.eq(7)
      })
    })
  })
})