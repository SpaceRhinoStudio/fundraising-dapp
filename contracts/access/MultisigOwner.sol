/**
* ENGA Federation Multisig.
* @author Mehdikovic
* Date created: 2022.02.15
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;


import { IERC173 } from "../interfaces/access/IERC173.sol";
import { Utils } from "../lib/Utils.sol";

abstract contract Owner is IERC173 {
    string constant internal ERROR_INVALID_ADDRESS                             = "ERROR_INVALID_ADDRESS";
    string constant internal ERROR_ONLY_MULTISIG_HAS_ACCESS                    = "ERROR_ONLY_MULTISIG_HAS_ACCESS";
    string constant internal ERROR_NEW_MULTISIG_MUST_BE_DIFFERENT_FROM_OLD_ONE = "ERROR_NEW_MULTISIG_MUST_BE_DIFFERENT_FROM_OLD_ONE";

    /// @notice multisig pointer as the owner
    address public owner;

    event OwnershipChanged(address indexed prevOwner, address indexed newOwner);

    /* STATE MODIFIERS */

    function transferOwnership(address _newOwner) external onlyMultisig {
        require(_newOwner != owner, ERROR_NEW_MULTISIG_MUST_BE_DIFFERENT_FROM_OLD_ONE);
        Utils.enforceHasContractCode(_newOwner, ERROR_INVALID_ADDRESS);

        _transferOwnership(_newOwner);
    }

    /* MODIFIERS */

    modifier onlyMultisig {
        require(msg.sender == owner, ERROR_ONLY_MULTISIG_HAS_ACCESS);
        _;
    }


    /* INTERNALS */

    //solhint-disable no-empty-blocks
    function _afterMultisigChanged(address _prevOwner, address _newOwner) internal virtual {}

    function _transferOwnership(address _newOwner) internal {
        address old = owner;
        owner = _newOwner;
        _afterMultisigChanged(old, _newOwner);
        
        emit OwnershipChanged(old, _newOwner);
    }
}

abstract contract MultisigOwner is Owner {
    constructor(address _owner) {
        Utils.enforceHasContractCode(_owner, ERROR_INVALID_ADDRESS);
        owner = _owner;
    }
}