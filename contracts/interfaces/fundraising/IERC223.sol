/**
* ENGA Federation IERC223 Token.
* @author Mehdikovic
* Date created: 2022.04.02
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

interface IERC223 {
    function tokenFallback(address _from, uint256 _value, bytes calldata _data) external;
}