/**
* ENGA Federation Tap Mechanism.
* @author Aragon.org
* Date created: 2022.03.08
* Github: mehdikovic
* SPDX-License-Identifier: AGPL-3.0
*/

pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ITap } from "../interfaces/fundraising/ITap.sol";
import { IController } from "../interfaces/fundraising/IController.sol";
import { IVaultERC20 } from "../interfaces/finance/IVaultERC20.sol";
import { EngalandBase } from "../common/EngalandBase.sol";
import { TimeHelper } from "../common/TimeHelper.sol";
import { Utils } from "../lib/Utils.sol";


contract Tap is ITap, TimeHelper, EngalandBase {
    uint256 public constant PCT_BASE = 10 ** 18; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18

    string private constant ERROR_INVALID_BENEFICIARY            = "TAP_INVALID_BENEFICIARY";
    string private constant ERROR_INVALID_BATCH_BLOCKS           = "TAP_INVALID_BATCH_BLOCKS";
    string private constant ERROR_INVALID_FLOOR_DECREASE_PCT     = "TAP_INVALID_FLOOR_DECREASE_PCT";
    string private constant ERROR_INVALID_TOKEN                  = "TAP_INVALID_TOKEN";
    string private constant ERROR_INVALID_TAP_RATE               = "TAP_INVALID_TAP_RATE";
    string private constant ERROR_INVALID_TAP_UPDATE             = "TAP_INVALID_TAP_UPDATE";
    string private constant ERROR_TOKEN_ALREADY_TAPPED           = "TAP_TOKEN_ALREADY_TAPPED";
    string private constant ERROR_TOKEN_NOT_TAPPED               = "TAP_TOKEN_NOT_TAPPED";
    string private constant ERROR_WITHDRAWAL_AMOUNT_ZERO         = "TAP_WITHDRAWAL_AMOUNT_ZERO";
    string private constant ERROR_INVALID_MARKETMAKER            = "ERROR_INVALID_MARKETMAKER";
    string private constant ERROR_INVALID_RESERVE                = "ERROR_INVALID_RESERVE";
    string private constant ERROR_INVALID_USER_ADDRESS           = "ERROR_INVALID_USER_ADDRESS";

    IController  public controller;
    IVaultERC20  public reserve;
    address      public beneficiary;
    uint256      public batchBlocks; // the same batch block passed to the market maker
    uint256      public maximumTapRateIncreasePct;
    uint256      public maximumTapFloorDecreasePct;

    mapping (address => uint256) public tappedAmounts;
    mapping (address => uint256) public rates;
    mapping (address => uint256) public floors;
    mapping (address => uint256) public lastTappedAmountUpdates; // batch ids [block numbers]
    mapping (address => uint256) public lastTapUpdates;  // timestamps

    event UpdateBeneficiary(address indexed beneficiary);
    event UpdateMaximumTapRateIncreasePct(uint256 maximumTapRateIncreasePct);
    event UpdateMaximumTapFloorDecreasePct(uint256 maximumTapFloorDecreasePct);
    event AddTappedToken(address indexed token, uint256 rate, uint256 floor);
    event RemoveTappedToken(address indexed token);
    event UpdateTappedToken(address indexed token, uint256 rate, uint256 floor);
    event ResetTappedToken(address indexed token);
    event UpdateTappedAmount(address indexed token, uint256 tappedAmount);
    event Withdraw(address indexed token, uint256 amount);

    //solhint-disable-next-line
    constructor(address _controller) EngalandBase(_controller) {}

    /**
    * @notice Initialize Tap
    * @param _batchBlocks                 the number of blocks batches are to last
    * @param _maximumTapRateIncreasePct   the maximum tap rate increase percentage allowed [in PCT_BASE]
    * @param _maximumTapFloorDecreasePct  the maximum tap floor decrease percentage allowed [in PCT_BASE]
    */
    function initialize(
        uint256 _batchBlocks,
        uint256 _maximumTapRateIncreasePct,
        uint256 _maximumTapFloorDecreasePct 
    ) 
        external
        onlyInitializer
    {
        _initialize();
        
        require(_batchBlocks != 0, ERROR_INVALID_BATCH_BLOCKS);
        require(_maximumTapFloorDecreasePctIsValid(_maximumTapFloorDecreasePct), ERROR_INVALID_FLOOR_DECREASE_PCT);

        address controller_ = _msgSender();
        controller = IController(controller_);
        reserve = IVaultERC20(controller.reserve());
        beneficiary =  controller.beneficiary();
        batchBlocks = _batchBlocks;
        maximumTapRateIncreasePct = _maximumTapRateIncreasePct;
        maximumTapFloorDecreasePct = _maximumTapFloorDecreasePct;
    }

    /* STATE MODIFIERS */

    /**
    * @notice Update beneficiary to `_beneficiary`
    * @param _beneficiary The address of the new beneficiary [to whom funds are to be withdrawn]
    */
    function updateBeneficiary(address _beneficiary) external onlyInitialized onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_beneficiaryIsValid(_beneficiary), ERROR_INVALID_BENEFICIARY);

        _updateBeneficiary(_beneficiary);
    }

    /**
    * @notice Update maximum tap rate increase percentage to `@formatPct(_maximumTapRateIncreasePct)`%
    * @param _maximumTapRateIncreasePct The new maximum tap rate increase percentage to be allowed [in PCT_BASE]
    */
    function updateMaximumTapRateIncreasePct(uint256 _maximumTapRateIncreasePct) external onlyInitialized onlyRole(DEFAULT_ADMIN_ROLE) {
        _updateMaximumTapRateIncreasePct(_maximumTapRateIncreasePct);
    }

    /**
    * @notice Update maximum tap floor decrease percentage to `@formatPct(_maximumTapFloorDecreasePct)`%
    * @param _maximumTapFloorDecreasePct The new maximum tap floor decrease percentage to be allowed [in PCT_BASE]
    */
    function updateMaximumTapFloorDecreasePct(uint256 _maximumTapFloorDecreasePct) external onlyInitialized onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_maximumTapFloorDecreasePctIsValid(_maximumTapFloorDecreasePct), ERROR_INVALID_FLOOR_DECREASE_PCT);

        _updateMaximumTapFloorDecreasePct(_maximumTapFloorDecreasePct);
    }

    /**
    * @notice Add tap for `_token.symbol(): string` with a rate of `@tokenAmount(_token, _rate)` per block and a floor of `@tokenAmount(_token, _floor)`
    * @param _token The address of the token to be tapped
    * @param _rate  The rate at which that token is to be tapped [in wei / block]
    * @param _floor The floor above which the reserve [pool] balance for that token is to be kept [in wei]
    */
    function addTappedToken(address _token, uint256 _rate, uint256 _floor) 
        external
        onlyInitialized
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        Utils.enforceHasContractCode(_token, ERROR_INVALID_TOKEN);
        require(!_tokenIsTapped(_token), ERROR_TOKEN_ALREADY_TAPPED);
        require(_tapRateIsValid(_rate), ERROR_INVALID_TAP_RATE);

        _addTappedToken(_token, _rate, _floor);
    }

    /**
    * @notice Remove tap for `_token.symbol(): string`
    * @param _token The address of the token to be un-tapped
    */
    function removeTappedToken(address _token) external onlyInitialized onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_tokenIsTapped(_token), ERROR_TOKEN_NOT_TAPPED);

        _removeTappedToken(_token);
    }

    /**
    * @notice Update tap for `_token.symbol(): string` with a rate of `@tokenAmount(_token, _rate)` per block and a floor of `@tokenAmount(_token, _floor)`
    * @param _token The address of the token whose tap is to be updated
    * @param _rate  The new rate at which that token is to be tapped [in wei / block]
    * @param _floor The new floor above which the reserve [pool] balance for that token is to be kept [in wei]
    */
    function updateTappedToken(address _token, uint256 _rate, uint256 _floor) external onlyInitialized onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_tokenIsTapped(_token), ERROR_TOKEN_NOT_TAPPED);
        require(_tapRateIsValid(_rate), ERROR_INVALID_TAP_RATE);
        require(_tapUpdateIsValid(_token, _rate, _floor), ERROR_INVALID_TAP_UPDATE);

        _updateTappedToken(_token, _rate, _floor);
    }

    /**
    * @notice Reset tap timestamps for `_token.symbol(): string`
    * @param _token The address of the token whose tap timestamps are to be reset
    */
    function resetTappedToken(address _token) external onlyInitialized onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_tokenIsTapped(_token), ERROR_TOKEN_NOT_TAPPED);

        _resetTappedToken(_token);
    }

    /**
    * @notice Update tapped amount for `_token.symbol(): string`
    * @param _token The address of the token whose tapped amount is to be updated
    */
    function updateTappedAmount(address _token) external onlyInitialized {
        require(_tokenIsTapped(_token), ERROR_TOKEN_NOT_TAPPED);

        _updateTappedAmount(_token);
    }

    /**
    * @notice Transfer about `@tokenAmount(_token, self.getMaximalWithdrawal(_token): uint256)` from `self.reserve()` to `self.beneficiary()`
    * @param _token The address of the token to be transfered
    */
    function withdraw(address _token) external onlyInitialized onlyRole(DEFAULT_ADMIN_ROLE){
        require(_tokenIsTapped(_token), ERROR_TOKEN_NOT_TAPPED);
        uint256 amount = _updateTappedAmount(_token);
        require(amount > 0, ERROR_WITHDRAWAL_AMOUNT_ZERO);

        _withdraw(_token, amount);
    }

    /***** PUBLIC VIEW *****/

    function tokenIsTapped(address _token) external view returns(bool) {
        return _tokenIsTapped(_token);
    }

    function getMaximumWithdrawal(address _token) public view returns (uint256) {
        return _tappedAmount(_token);
    }

    function getCurrentBatchId() public view returns (uint256) {
        return _currentBatchId();
    }

    /***** INTERNAL *****/

    function _currentBatchId() internal view returns (uint256) {
        return getBatchId(batchBlocks);
    }

    function _tappedAmount(address _token) internal view returns (uint256) {
        uint256 toBeKept = controller.collateralsToBeClaimed(_token) + floors[_token];
        uint256 balance = reserve.balanceERC20(_token);
        uint256 flow = (_currentBatchId() - lastTappedAmountUpdates[_token]) * rates[_token];
        uint256 tappedAmount = tappedAmounts[_token] + flow;

        if (balance <= toBeKept) {
            return 0;
        }

        if (balance <= toBeKept + tappedAmount) {
            return balance - toBeKept;
        }

        return tappedAmount;
    }

    function _beneficiaryIsValid(address _beneficiary) internal pure returns (bool) {
        return _beneficiary != address(0);
    }

    function _maximumTapFloorDecreasePctIsValid(uint256 _maximumTapFloorDecreasePct) internal pure returns (bool) {
        return _maximumTapFloorDecreasePct <= PCT_BASE;
    }

    function _tokenIsTapped(address _token) internal view returns (bool) {
        return rates[_token] != uint256(0);
    }

    function _tapRateIsValid(uint256 _rate) internal pure returns (bool) {
        return _rate != 0;
    }

    function _tapUpdateIsValid(address _token, uint256 _rate, uint256 _floor) internal view returns (bool) {
        return _tapRateUpdateIsValid(_token, _rate) && _tapFloorUpdateIsValid(_token, _floor);
    }

    function _tapRateUpdateIsValid(address _token, uint256 _rate) internal view returns (bool) {
        uint256 rate = rates[_token];

        if (_rate <= rate) {
            return true;
        }

        if (getTimeNow() < lastTapUpdates[_token] + 30 days) {
            return false;
        }

        if (_rate * PCT_BASE <= rate * (PCT_BASE + maximumTapRateIncreasePct)) {
            return true;
        }

        return false;
    }

    function _tapFloorUpdateIsValid(address _token, uint256 _floor) internal view returns (bool) {
        uint256 floor = floors[_token];

        if (_floor >= floor) {
            return true;
        }

        if (getTimeNow() < lastTapUpdates[_token] + 30 days) {
            return false;
        }

        if (maximumTapFloorDecreasePct >= PCT_BASE) {
            return true;
        }

        if (_floor * PCT_BASE >= floor * (PCT_BASE + maximumTapFloorDecreasePct)) {
            return true;
        }

        return false;
    }

    /**** INTERNAL STATE MODIFIERS ****/

    function _updateTappedAmount(address _token) internal returns (uint256) {
        uint256 tappedAmount = _tappedAmount(_token);
        lastTappedAmountUpdates[_token] = _currentBatchId();
        tappedAmounts[_token] = tappedAmount;

        emit UpdateTappedAmount(_token, tappedAmount);

        return tappedAmount;
    }

    function _updateBeneficiary(address _beneficiary) internal {
        beneficiary = _beneficiary;
        emit UpdateBeneficiary(_beneficiary);
    }

    function _updateMaximumTapRateIncreasePct(uint256 _maximumTapRateIncreasePct) internal {
        maximumTapRateIncreasePct = _maximumTapRateIncreasePct;
        emit UpdateMaximumTapRateIncreasePct(_maximumTapRateIncreasePct);
    }

    function _updateMaximumTapFloorDecreasePct(uint256 _maximumTapFloorDecreasePct) internal {
        maximumTapFloorDecreasePct = _maximumTapFloorDecreasePct;
        emit UpdateMaximumTapFloorDecreasePct(_maximumTapFloorDecreasePct);
    }

    function _addTappedToken(address _token, uint256 _rate, uint256 _floor) internal {
        rates[_token] = _rate;
        floors[_token] = _floor;
        lastTappedAmountUpdates[_token] = _currentBatchId();
        lastTapUpdates[_token] = getTimeNow();

        emit AddTappedToken(_token, _rate, _floor);
    }

    function _removeTappedToken(address _token) internal {
        delete tappedAmounts[_token];
        delete rates[_token];
        delete floors[_token];
        delete lastTappedAmountUpdates[_token];
        delete lastTapUpdates[_token];

        emit RemoveTappedToken(_token);
    }

    function _updateTappedToken(address _token, uint256 _rate, uint256 _floor) internal {
        uint256 amount = _updateTappedAmount(_token);
        if (amount > 0) {
            _withdraw(_token, amount);
        }

        rates[_token] = _rate;
        floors[_token] = _floor;
        lastTapUpdates[_token] = getTimeNow();

        emit UpdateTappedToken(_token, _rate, _floor);
    }

    function _resetTappedToken(address _token) internal {
        tappedAmounts[_token] = 0;
        lastTappedAmountUpdates[_token] = _currentBatchId();
        lastTapUpdates[_token] = getTimeNow();

        emit ResetTappedToken(_token);
    }

    function _withdraw(address _token, uint256 _amount) internal {
        tappedAmounts[_token] = tappedAmounts[_token] - _amount;
        reserve.transferERC20(_token, beneficiary, _amount);
        
        emit Withdraw(_token, _amount);
    }
}