/**
* ENGA Federation EngalandBase.
* @author Mehdikovic
* Date created: 2022.06.18
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

abstract contract EngalandBase is AccessControl {
    string private constant ERROR_CONTRACT_HAS_BEEN_INITIALIZED_BEFORE = "ERROR_CONTRACT_HAS_BEEN_INITIALIZED_BEFORE";
    string private constant ERROR_ONLY_CONTROLLER_CAN_CALL             = "ERROR_ONLY_CONTROLLER_CAN_CALL";

    bool private _isInitialized = false;

    constructor(address _controller) {
        _grantRole(DEFAULT_ADMIN_ROLE, _controller);
    }

    function _initialize() internal {
        require(!_isInitialized, ERROR_CONTRACT_HAS_BEEN_INITIALIZED_BEFORE);
        _isInitialized = true;
    }

    modifier onlyInitialized {
        require(_isInitialized);
        _;
    }

    modifier onlyInitializer {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), ERROR_ONLY_CONTROLLER_CAN_CALL);
        _;
    }

    function isInitialized() external view returns (bool) {
        return _isInitialized;
    }
}