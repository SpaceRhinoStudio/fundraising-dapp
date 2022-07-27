/**
* ENGA Federation CoreMultisig.
* @author Nikola Madjarevic, Mehdikovic
* Date created: 2022.02.15
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { VaultERC20   } from "../finance/VaultERC20.sol";
import { VaultERC721  } from "../finance/VaultERC721.sol";
import { VaultERC1155 } from "../finance/VaultERC1155.sol";
import { BaseMultisig } from "./BaseMultisig.sol";
import { Utils } from "../lib/Utils.sol";

contract CoreMultisig is BaseMultisig, VaultERC20, VaultERC721, VaultERC1155, AccessControl, ReentrancyGuard {
    /**
    bytes32 constant public TRANSFER_ROLE = keccak256("TRANSFER_ROLE");
    */ 
    bytes32 constant public TRANSFER_ROLE = 0x8502233096d909befbda0999bb8ea2f3a6be3c138b9fbf003752a4c8bce86f6c;
    
    constructor(address[] memory initialCoreMembers) {
        for(uint256 i = 0; i < initialCoreMembers.length; i++) {
            Utils.enforceValidAddress(initialCoreMembers[i], ERROR_INVALID_ADDRESS);
            require(addr2Member[initialCoreMembers[i]].isMember == false, ERROR_ALREADY_MEMBER_OF_FEDERATION);
            _addMember(initialCoreMembers[i]);
        }

        owner = address(this);
        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(TRANSFER_ROLE, owner);
    }

    /* EXTERNALS */
    
    /* BEGIN Member Registry */
    function addMember(address _member) external onlyMultisig {
        Utils.enforceValidAddress(_member, ERROR_INVALID_ADDRESS);
        require(addr2Member[_member].isMember == false, ERROR_ALREADY_MEMBER_OF_FEDERATION);

        _addMember(_member);
    }

    function removeMember(address _member) external onlyMultisig {
        require(addr2Member[_member].isMember == true, ERROR_IS_NOT_A_MEMBER);
        require(addr2Member[_member].index < members.length, ERROR_INDEX_OUT_OF_RANGE);

        _removeMember(_member);
    }

    function swapMember(address _old, address _new) external onlyMultisig {
        Utils.enforceValidAddress(_new, ERROR_INVALID_ADDRESS);
        require(addr2Member[_old].isMember == true, ERROR_IS_NOT_A_MEMBER);
        require(addr2Member[_new].isMember == false, ERROR_IS_NOT_A_MEMBER);
        
        _swapMember(_old, _new);
    }
    /* END Member Registry*/

    /* BEGIN Vaults */
    
    function depositERC20(address _token, uint256 _value) 
        external payable
        nonReentrant
    {
        _depositERC20(_token, _value);
    }

    function transferERC20(
        address _token,
        address _to,
        uint256 _value
    ) 
        external
        nonReentrant
    {
        require(hasRole(TRANSFER_ROLE, _msgSender()));
        _transfer(_token, _to, _value);
    }

    /** ERC721Vault */
    function depositERC721(
        address _token,
        uint256 _tokenId,
        bytes memory _data
    ) 
        external
        nonReentrant
    {
        _depositERC721(_token, _tokenId, _data);
    }

    function transferERC721(
        address _token,
        address _to,
        uint256 _tokenId,
        bytes memory _data
    )
        external 
        nonReentrant
        onlyRole(TRANSFER_ROLE)
    {
        _transferERC721(_token, _to, _tokenId, _data);
    }
    /** ERC721Vault */

    /** ERC1155Vault */
    function depositERC1155(
        address _token,
        uint256 _id,
        uint256 _amount,
        bytes memory _data
    ) 
        external
        nonReentrant
    {
        _depositERC1155(_token, _id, _amount, _data);
    }
    
    function batchDepositERC1155(
        address _token,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) 
        external
        nonReentrant
    {
        _batchDepositERC1155(_token, _ids, _amounts, _data);
    }
    
    function transferERC1155(
        address _token,
        address _to,
        uint256 _id,
        uint256 _amount,
        bytes memory _data
    ) 
        external
        nonReentrant
        onlyRole(TRANSFER_ROLE)
    {
        _transferERC1155(_token, _to, _id, _amount, _data);
    }

    function batchTransferERC1155(
        address _token,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) 
        external
        nonReentrant
        onlyRole(TRANSFER_ROLE)
    {
        _batchTransferERC1155(_token, _to, _ids, _amounts, _data);
    }
    /** ERC1155Vault */
    /* END Vaults */

    /* BEGIN BaseMultisig */
    function createTransaction(
        address _target,
        uint256 _value,
        string memory _signature,
        bytes memory _calldatas,
        string memory _description
    ) 
        external 
        onlyMember
        returns (uint256 transactionId) 
    {
        Utils.enforceHasContractCode(_target, ERROR_TARGET_IS_NOT_VALID_CONTRACT);

        transactionId = _createTransaction(
            _target,
            _value,
            _signature,
            _calldatas,
            _description
        );
    }

    function executeAll(uint256[] calldata transactionIds, bytes[][] calldata signatures) external payable onlyMember nonReentrant {
        require(transactionIds.length > 0);
        require(transactionIds.length == signatures.length);

        for (uint256 i = 0; i < transactionIds.length; i++) {
            _checkAndExecute(transactionIds[i], signatures[i]);
        }
    }

    function execute(uint256 transactionId, bytes[] calldata signatures) external payable onlyMember nonReentrant {
        _checkAndExecute(transactionId, signatures);
    }

    function cancel(uint256 transactionId) external onlyMember {
        Transaction storage transaction = transactions[transactionId];
        
        require(transactionId > 0 && transactionId <= transactionCount, ERROR_INVALID_TRANSACTION);
        require(transaction.executed == false, ERROR_TRANSACTION_HAS_BEEN_EXECUTED);
        require(transaction.canceled == false, ERROR_TRANSACTION_HAS_BEEN_EXECUTED);

        _cancel(transaction);
    }
    /* END BaseMultisig */

    /* EXTERNAL VIEW */
    function getQuorum() external view returns(uint256) {
        return _getQuorum();
    }

    /* INTERNAL VIEW */
    function _getQuorum() internal view returns(uint256) {
        return (members.length / 2) + 1;
    }

    /* INTERNALS */
    function _checkAndExecute(uint256 transactionId, bytes[] calldata signatures) private {
        Transaction storage transaction = transactions[transactionId];
        
        require(transactionId > 0 && transactionId <= transactionCount, ERROR_INVALID_TRANSACTION);
        require(transaction.executed == false, ERROR_TRANSACTION_HAS_BEEN_EXECUTED);
        require(transaction.canceled == false, ERROR_TRANSACTION_HAS_BEEN_CANCELED);
        
        uint256 len = signatures.length;
        uint256 quorum = _getQuorum();
        require(len >= quorum, ERROR_QUORUM_IS_NOT_REACHED);

        uint256 currentQuorum = 0;
        address[] memory addrs = new address[](quorum);
        bytes32 message = ECDSA.toEthSignedMessageHash(keccak256(abi.encodePacked(block.chainid, address(this), transactionId)));

        for (uint256 i = 0; i < signatures.length; i++) {
            (address signer, ECDSA.RecoverError err) = ECDSA.tryRecover(message, signatures[i]);
            
            require(err == ECDSA.RecoverError.NoError);
            require(_isMember(signer), ERROR_ONLY_MEMBERS_HAVE_ACCESS);

            if (i > 0) {
                for (uint256 j = 0; j < quorum; j++) {
                    require (addrs[j] != signer, ERROR_CONFIRMATION_IS_DONE_BEFORE);
                }
            }
            
            addrs[i] = signer;
            currentQuorum++;

            if (currentQuorum == quorum) {
                _execute(transaction);
                return;
            }
        }

        revert();
    }
}