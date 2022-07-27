/**
* MockAccessControl.
* @author Mehdikovic
* Date created: 2022.03.02
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../finance/VaultERC20.sol";
import "../common/TimeHelper.sol";
import "../access/EngalandAccessControl.sol";


contract MockAccessControl is VaultERC20, EngalandAccessControlEnumerable, TimeHelper, ReentrancyGuard {
    /**
    bytes32 constant public TRANSFER_ROLE           = keccak256("TRANSFER_ROLE");
    bytes32 constant public CHANGE_DAILY_LIMIT_ROLE = keccak256("CHANGE_DAILY_LIMIT_ROLE");
    */ 
    bytes32 constant public TRANSFER_ROLE           = 0x8502233096d909befbda0999bb8ea2f3a6be3c138b9fbf003752a4c8bce86f6c;
    bytes32 constant public CHANGE_DAILY_LIMIT_ROLE = 0xb168b0486c150afe2b61f3191d3fd7ef023ec417ef8927def0d046b4deb0df5d;

    string constant private ERROR_ZERO_ADDRESS                = "ERROR_ZERO_ADDRESS";
    string constant private ERROR__INVALID_DAILY_LIMIT        = "ERROR_ZERO_ADDRESS";
    string constant private ERROR_WITHDRAW_LIMITATION_REACHED = "ERROR_WITHDRAW_LIMITATION_REACHED";
    
    uint public dailyLimit;
    mapping(address => mapping(address => uint256)) public lastDay; // token => user => lastDay
    mapping(address => mapping(address => uint256)) public spentToday; // token => user => spentToday

    event DailyLimitChange(uint dailyLimit);
    event IndividualWithdraw(address indexed user, uint256 amount);

    constructor(
        address _owner,
        uint256 _dailyLimit,
        address owner1,
        address owner2,
        address owner3,
        address owner4
    ) 
        EngalandAccessControlEnumerable(_owner) 
    {
        dailyLimit = _dailyLimit;

        _grantRole(TRANSFER_ROLE, owner1);
        _grantRole(TRANSFER_ROLE, owner2);
        _grantRole(TRANSFER_ROLE, owner3);
        _grantRole(TRANSFER_ROLE, owner4);
        
        _grantRole(CHANGE_DAILY_LIMIT_ROLE, owner1);
        _grantRole(CHANGE_DAILY_LIMIT_ROLE, owner2);
    }

    function depositERC20(address _token, uint256 _value) 
        external payable
        nonReentrant
    {
        _depositERC20(_token, _value);
    }

    function transferERC20(address _token, address _to, uint256 _value)
        external
        onlyMultisigOrRole(TRANSFER_ROLE)
        nonReentrant
    {
        address sender = _msgSender();
        
        require(isUnderLimit(_token, sender, _value), ERROR_WITHDRAW_LIMITATION_REACHED);
        spentToday[_token][sender] += _value;
        _transfer(_token, _to, _value);
        
        emit IndividualWithdraw(sender, _value);
    }

    function dailyLimitToTheMoon(uint256 _dailyLimit)
        external
        onlyRole(CHANGE_DAILY_LIMIT_ROLE)
    {
        dailyLimit = _dailyLimit;
        emit DailyLimitChange(_dailyLimit);
    }

    function addNumberToDaily(uint256 _adder)
        external
        onlyMultisig
    {
        dailyLimit += _adder;
    }

    /* INTERNALS */

    function isUnderLimit(address _token, address _sender, uint256 amount)
        internal
        returns (bool)
    {
        if (getTimeNow() > lastDay[_token][_sender] + 24 hours) {
            lastDay[_token][_sender] = getTimeNow();
            spentToday[_token][_sender] = 0;
        }
        
        if (
            spentToday[_token][_sender] + amount > dailyLimit ||
            spentToday[_token][_sender] + amount < spentToday[_token][_sender]
        ) {
            return false;
        }
        
        return true;
    }
}