/**
* ENGA Federation BancorFormula Interface.
* @author Aragon.org, Mehdikovic
* Date created: 2022.03.09
* Github: mehdikovic
* SPDX-License-Identifier: AGPL-3.0
*/

pragma solidity ^0.8.0;

interface IBancor {
    function calculatePurchaseReturn(uint256 _supply, uint256 _connectorBalance, uint32 _connectorWeight, uint256 _depositAmount) external view returns (uint256);
    function calculateSaleReturn(uint256 _supply, uint256 _connectorBalance, uint32 _connectorWeight, uint256 _sellAmount) external view returns (uint256);
}