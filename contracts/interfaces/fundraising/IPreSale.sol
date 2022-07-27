/**
* ENGA Federation PreSale Interface.
* @author Mehdikovic
* Date created: 2022.03.06
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

enum SaleState {
    Pending,     // presale is idle and pending to be started
    Funding,     // presale has started and contributors can purchase tokens
    Refunding,   // presale has not reached goal within period and contributors can claim refunds
    GoalReached, // presale has reached goal within period and trading is ready to be open
    Closed       // presale has reached goal within period, has been closed and trading has been open
}

interface IPreSale {

    function openByDate(uint256 _openDate) external;
    function openNow() external;
    function close() external;
    function state() external view returns (SaleState);
    function getController() external view returns(address);
    function contribute(address _contributor, uint256 _value) external;
    function refund(address _contributor, bytes32 _vestedPurchaseId) external;
    function contributionToTokens(uint256 _contribution) external view returns (uint256);
    function tokenToContributions(uint256 _engaToken) external view returns (uint256);
}