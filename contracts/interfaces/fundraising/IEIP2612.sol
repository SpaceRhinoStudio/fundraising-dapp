/**
* ENGA Federation EIP2621, ERC20 Extension.
* @author Mehdikovic
* Date created: 2022.04.27
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

interface IEIP2612 {
    function permit(address owner, address spender, uint value, uint deadline, uint8 v, bytes32 r, bytes32 s) external;
    function nonces(address owner) external view returns (uint);
    // solhint-disable func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}
