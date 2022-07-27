/**
* ENGA Federation Tap Interface.
* @author Mehdikovic
* Date created: 2022.03.08
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

interface ITap {
    function initialize(uint256 _batchBlocks, uint256 _maximumTapRateIncreasePct, uint256 _maximumTapFloorDecreasePct) external;
    function updateBeneficiary(address _beneficiary) external;
    function updateMaximumTapRateIncreasePct(uint256 _maximumTapRateIncreasePct) external;
    function updateMaximumTapFloorDecreasePct(uint256 _maximumTapFloorDecreasePct) external;
    function addTappedToken(address _token, uint256 _rate, uint256 _floor) external;
    function removeTappedToken(address _token) external;
    function updateTappedToken(address _token, uint256 _rate, uint256 _floor) external;
    function resetTappedToken(address _token) external;
    function updateTappedAmount(address _token) external;
    function withdraw(address _token) external;
    function getMaximumWithdrawal(address _token) external view returns (uint256);
    function tokenIsTapped(address _token) external view returns(bool);
}