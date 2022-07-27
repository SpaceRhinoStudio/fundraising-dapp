/**
* ENGA Federation Default Vault.
* @author Mehdikovic
* Date created: 2022.03.02
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

// merge it with treasury

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./VaultERC20.sol";
import "../common/EngalandBase.sol";

contract Vault is VaultERC20, EngalandBase, ReentrancyGuard {
    /**
    bytes32 constant public TRANSFER_ROLE = keccak256("TRANSFER_ROLE");
    */ 
    bytes32 constant public TRANSFER_ROLE = 0x8502233096d909befbda0999bb8ea2f3a6be3c138b9fbf003752a4c8bce86f6c;

    constructor(address _controller) EngalandBase(_controller) {
        _initialize();
        _grantRole(TRANSFER_ROLE, _controller);
    }
    
    /* STATE MODIFIERS */

    function depositERC20(address _token, uint256 _value) 
        external payable
        nonReentrant
    {
        _depositERC20(_token, _value);
    }

    function transferERC20(address _token, address _to, uint256 _value) 
        external
        onlyRole(TRANSFER_ROLE)
        nonReentrant
    {
        _transfer(_token, _to, _value);
    }
}