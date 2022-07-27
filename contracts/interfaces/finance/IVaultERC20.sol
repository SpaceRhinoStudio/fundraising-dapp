/**
* ENGA Federation IVaultERC20.
* @author Mehdikovic
* Date created: 2022.03.08
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

interface IVaultERC20 {
    function balanceERC20(address _token) external view returns (uint256);
    function depositERC20(address _token, uint256 _value) external payable;
    function transferERC20(address _token, address _to, uint256 _value) external;
}