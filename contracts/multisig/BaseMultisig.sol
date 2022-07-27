/**
* ENGA Federation CoreMultisig.
* @author Nikola Madjarevic, Mehdikovic
* Date created: 2022.05.05
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

import { Owner } from "../access/MultisigOwner.sol";
import { Utils }  from "../lib/Utils.sol";


abstract contract MemberRegistry is Owner {
    uint256 constant internal MAX_UINT = type(uint256).max;

    string constant internal ERROR_IS_NOT_A_MEMBER                 = "ERROR_IS_NOT_A_MEMBER";
    string constant internal ERROR_INDEX_OUT_OF_RANGE              = "ERROR_INDEX_OUT_OF_RANGE";
    string constant internal ERROR_ALREADY_MEMBER_OF_FEDERATION    = "ERROR_ALREADY_MEMBER_OF_FEDERATION";
    string constant internal ERROR_ONLY_MEMBERS_HAVE_ACCESS        = "ERROR_ONLY_MEMBERS_HAVE_ACCESS";

    /// @notice Event to fire every time someone is added or removed from addr2Member
    event MembershipChanged(address member, bool isMember);

    /// @notice Event to fire every time a member is replaced by another address
    event MembershipSwapped(address from, address to);

    struct Member {
        uint256 index;
        bool isMember;
    }
    
    address[] public members;
    mapping(address => Member) public addr2Member;

    // MODIFIERS

    modifier onlyMember() {
        require(addr2Member[msg.sender].isMember == true, ERROR_ONLY_MEMBERS_HAVE_ACCESS);
        _;
    }

    /* EXTERNAL VIEWS */

    function getNumberOfMembers() external view returns (uint) {
        return members.length;
    }

    function getAllMemberAddresses() external view returns (address[] memory) {
        return members;
    }

    function getMemberInfo(address _member) external view returns (Member memory) {
        require(addr2Member[_member].isMember, ERROR_IS_NOT_A_MEMBER);
        return addr2Member[_member];
    }

    function isMember(address _member) external view returns (bool) {
        return _isMember(_member);
    }

    /* INTERNALS */

    function _removeMember(address _member) internal {
        members[addr2Member[_member].index] = members[members.length - 1];
        members.pop();

        addr2Member[_member].isMember = false;
        addr2Member[_member].index = MAX_UINT;

        emit MembershipChanged(_member, false);
    }

    function _swapMember(address _old, address _new) internal {
        uint256 oldIndex = addr2Member[_old].index;

        addr2Member[_old].isMember = false;
        addr2Member[_old].index = MAX_UINT;

        members[oldIndex] = _new;
        addr2Member[_new].index = oldIndex;
        addr2Member[_new].isMember = true;

        emit MembershipChanged(_old, false);
        emit MembershipChanged(_new, true); // membership is identical
        emit MembershipSwapped(_old, _new);
    }

    function _addMember(address _member) internal {
        addr2Member[_member].index = members.length;
        addr2Member[_member].isMember = true;

        members.push(_member);
        
        emit MembershipChanged(_member, true);
    }

    /* VIEW INTERNALS */

    function _isMember(address _member) internal view returns(bool) {
        return addr2Member[_member].isMember;
    }
}

abstract contract BaseMultisig is MemberRegistry {
    string constant internal ERROR_TRANSACTION_HAS_BEEN_EXECUTED = "ERROR_TRANSACTION_HAS_BEEN_EXECUTED";
    string constant internal ERROR_TRANSACTION_HAS_BEEN_CANCELED = "ERROR_TRANSACTION_HAS_BEEN_CANCELED";
    string constant internal ERROR_TARGET_IS_NOT_VALID_CONTRACT  = "ERROR_TARGET_IS_NOT_VALID_CONTRACT";
    string constant internal ERROR_QUORUM_IS_NOT_REACHED         = "ERROR_QUORUM_IS_NOT_REACHED";
    string constant internal ERROR_INVALID_TRANSACTION           = "ERROR_INVALID_TRANSACTION";
    string constant internal ERROR_CONFIRMATION_IS_DONE_BEFORE   = "ERROR_CONFIRMATION_IS_DONE_BEFORE";
    
    struct Transaction {
        uint256 id; // Unique id for looking up a transaction
        address target; // the target addresses for calls to be made
        uint256 value; // The value (i.e. msg.value) to be passed to the calls to be made
        string signature; // The function signature to be called
        bytes calldatas; // The calldata to be passed to each call
        bool canceled; // Flag marking whether the transaction has been canceled
        bool executed; // Flag marking whether the transaction has been executed
    }

    uint256 public transactionCount;
    mapping(uint256 => Transaction) public transactions;

    event TransactionCreated(
        uint256 id,
        address indexed sender,
        address indexed target,
        uint256 value,
        string signature,
        bytes calldatas,
        string description
    );
    event TransactionCanceled(uint256 transactionId);
    event TransactionExecuted(
        address indexed target,
        uint256 id,
        uint256 value,
        string signature,
        bytes calldatas,
        bytes returndata
    );
    event TransactionFailed(
        address indexed target,
        uint256 id,
        uint256 value,
        string signature,
        bytes calldatas,
        bytes returndata
    );

    /* EXTERNAL VIEWS */

    function getTransaction(uint256 transactionId) external view returns(Transaction memory) {
        require(transactionId > 0 && transactionId <= transactionCount, ERROR_INVALID_TRANSACTION);
        return transactions[transactionId];
    }

    /* INTERNALS */

    function _createTransaction(
        address _target,
        uint256 _value,
        string memory _signature,
        bytes memory _calldatas,
        string memory _description
    ) 
        internal 
        returns (uint256)
    {
        transactionCount++;
        Transaction memory newTransaction = Transaction({
            id: transactionCount,
            target: _target,
            value: _value,
            signature: _signature,
            calldatas: _calldatas,
            canceled: false,
            executed: false
        });
        transactions[transactionCount] = newTransaction;

        emit TransactionCreated(
            transactionCount,
            msg.sender,
            _target,
            _value,
            _signature,
            _calldatas,
            _description
        );
        return transactionCount;
    }

    function _execute(Transaction storage transaction) internal {
        transaction.executed = true;

        bytes memory callData;

        if (bytes(transaction.signature).length == 0) {
            callData = transaction.calldatas;
        } else {
            callData = abi.encodePacked(Utils.getSig(transaction.signature), transaction.calldatas);
        }

        // solhint-disable avoid-low-level-calls
        (bool success, bytes memory returndata) = transaction.target.call{value: transaction.value}(callData);

        if (success) {
            emit TransactionExecuted(
                transaction.target,
                transaction.id,
                transaction.value,
                transaction.signature,
                transaction.calldatas,
                returndata
            );
        } else {
            transaction.executed = false;
            emit TransactionFailed(
                transaction.target,
                transaction.id,
                transaction.value,
                transaction.signature,
                transaction.calldatas,
                returndata
            );
        }
    }

    function _cancel(Transaction storage transaction) internal {
        transaction.canceled = true;
        emit TransactionCanceled(transaction.id);
    }
}