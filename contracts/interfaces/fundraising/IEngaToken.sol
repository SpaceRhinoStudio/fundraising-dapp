/**
* ENGA Federation IEngaToken Interface.
* @author Aragon.org, Mehdikovic
* Date created: 2022.06.20
* Github: mehdikovic
* SPDX-License-Identifier: AGPL-3.0
*/

pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IEIP2612 } from "../fundraising/IEIP2612.sol";

interface IEngaToken is IERC20, IEIP2612 {
    event Minted(address indexed receiver, uint256 amount);
    event Burned(address indexed burner, uint256 amount);

    function mint(address _receiver, uint256 _amount) external;
    function burn(address _burner, uint256 _amount) external;

    //EIP-223 LOGIC
    function transfer(address _to, uint256 _amount, bytes calldata _data) external returns (bool);

    //EIP-2612 LOGIC
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
    
    // solhint-disable func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}