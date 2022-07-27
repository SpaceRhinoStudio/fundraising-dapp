/**
* ENGA Federation Accress Control contract.
* @author Mehdikovic
* Date created: 2022.03.01
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

import {MultisigOwner} from "./MultisigOwner.sol";


abstract contract EngalandAccessControlEnumerable is MultisigOwner, AccessControlEnumerable {
    
    constructor(address _owner) MultisigOwner(_owner) {
        _grantRole(DEFAULT_ADMIN_ROLE, owner);
    }

    modifier onlyMultisigOrRole(bytes32 _role) {
        require(_msgSender() == owner || hasRole(_role,_msgSender()), "ONLY MULTI-SIG OR SPECIFIC ROLE HAS ACCESS");
        _;
    }

    // CALLBACK FROM MultisigOwner
    function _afterMultisigChanged(address _prevOwner, address _newOwner) internal virtual override {
        _revokeRole(DEFAULT_ADMIN_ROLE, _prevOwner);
        _grantRole(DEFAULT_ADMIN_ROLE, _newOwner);
    }
}

abstract contract EngalandAccessControl is MultisigOwner, AccessControl {
    
    constructor(address _owner) MultisigOwner(_owner) {
        _grantRole(DEFAULT_ADMIN_ROLE, owner);
    }

    modifier onlyMultisigOrRole(bytes32 _role) {
        require(_msgSender() == owner || hasRole(_role,_msgSender()), "ONLY MULTI-SIG OR SPECIFIC ROLE HAS ACCESS");
        _;
    }

    // CALLBACK FROM MultisigOwner
    function _afterMultisigChanged(address _prevOwner, address _newOwner) internal virtual override {
        _revokeRole(DEFAULT_ADMIN_ROLE, _prevOwner);
        _grantRole(DEFAULT_ADMIN_ROLE, _newOwner);
    }
}