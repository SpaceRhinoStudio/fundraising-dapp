/**
* ENGA Federation ITeamSplitterPayment.
* @author Mehdikovic
* Date created: 2022.07.25
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

import { PaymentSplitter } from "@openzeppelin/contracts/finance/PaymentSplitter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPaymentSplitter {
    function splitAll() external;
    function totalShares() external view returns (uint256);
    function totalReleased() external view returns (uint256);
    function totalReleased(IERC20 token) external view returns (uint256);
    function shares(address account) external view returns (uint256);
    function released(address account) external view returns (uint256);
    function released(IERC20 token, address account) external view returns (uint256);
    function payee(uint256 index) external view returns (address);
    function release(address payable account) external;
    function release(IERC20 token, address account) external;
}