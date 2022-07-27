/**
* ENGA Federation KycAuthorization contract.
* @author Mehdikovic
* Date created: 2022.03.23
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

import "../interfaces/access/IKycAuthorization.sol";

import "../common/EngalandBase.sol";

contract KycAuthorization is IKycAuthorization, EngalandBase {
    
    bool public isKycEnable;
    mapping(address => bool) public kycUsers;

    string private constant ERROR_INVALID_USER_ADDRESS      = "KYC_INVALID_USER_ADDRESS";
    string private constant ERROR_KYC_IS_ALREADY_ENABLE     = "KYC_KYC_IS_ALREADY_ENABLE";
    string private constant ERROR_KYC_IS_ALREADY_DISABLE    = "KYC_KYC_IS_ALREADY_DISABLE";
    string private constant ERROR_USER_HAS_NOT_BEEN_KYC     = "KYC_USER_HAS_NOT_BEEN_KYC";
    string private constant ERROR_USER_HAS_ALREADY_BEEN_KYC = "KYC_USER_HAS_ALREADY_BEEN_KYC";

    event EnableKyc(address indexed caller);
    event DisableKyc(address indexed caller);
    event KycUserAdded(address indexed user);
    event KycUserRemoved(address indexed user);

    constructor(address _controller) EngalandBase(_controller) {
        _initialize();
    }

    /* STATE MODIFIERS */
    
    function enableKyc() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isKycEnable == false, ERROR_KYC_IS_ALREADY_ENABLE);

        isKycEnable = true;
        
        emit EnableKyc(_msgSender());
    }

    function disableKyc() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isKycEnable == true, ERROR_KYC_IS_ALREADY_DISABLE);

        isKycEnable = false;

        emit DisableKyc(_msgSender());
    }

    function addKycUser(address _user) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(kycUsers[_user] == false, ERROR_USER_HAS_ALREADY_BEEN_KYC);

        kycUsers[_user] = true;

        emit KycUserAdded(_user);
    }

    function removeKycUser(address _user) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(kycUsers[_user] == true, ERROR_USER_HAS_NOT_BEEN_KYC);

        kycUsers[_user] = false;

        emit KycUserRemoved(_user);
    }

    /* MODIFIERS */

    modifier kycRequired(address _user) {
        if (isKycEnable) {
            require(kycUsers[_user] == true, ERROR_USER_HAS_NOT_BEEN_KYC);
            _;
        } else {
            _;
        }
    }

    /* PUBLIC VIEWS */

    function getKycOfUser(address _user) external virtual view returns (bool isKyc) {
        if (isKycEnable) {
            isKyc = kycUsers[_user];
        } else {
            isKyc = true;
        }
    }
}