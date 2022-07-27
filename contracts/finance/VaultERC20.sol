/**
* ENGA Federation VaultERC20.
* @author Mehdikovic
* Date created: 2022.03.02
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/finance/IVaultERC20.sol";
import "../common/NativeToken.sol";
import "../lib/Utils.sol";

abstract contract VaultERC20 is IVaultERC20, NativeToken {
    using SafeERC20 for IERC20;

    event VaultTransfer(address indexed token, address indexed to, uint256 amount);
    event VaultDeposit(address indexed token, address indexed sender, uint256 amount);
    
    /* STATE MODIFIERS */

    receive() external payable {
        _depositERC20(NATIVE, msg.value);
    }

    /* VIEWS */

    function balanceERC20(address _token) external view returns (uint256) {
        return _balance(_token);
    }

    /* INTERNALS */

    function _depositERC20(address _token, uint256 _value) internal {
        require(_value > 0, "ERROR DEPOSIT VALUE ZERO");
        
        if (_token == NATIVE) {
            require(msg.value == _value, "ERROR VALUE MISMATCH");
        } else {
            IERC20(_token).safeTransferFrom(msg.sender, address(this), _value);
        }

        emit VaultDeposit(_token, msg.sender, _value);
    }

    function _transfer(address _token, address _to, uint256 _value) internal {
        require(_value > 0, "ERROR TRANSFER VALUE ZERO");

        if (_token == NATIVE) {
            require(Utils.transferNativeToken(_to, _value),  "ERROR SEND REVERTED");
        } else {
            IERC20(_token).safeTransfer(_to, _value);
        }

        emit VaultTransfer(_token, _to, _value);
    }

    /* INTERNAL VIEWS */
    
    function _balance(address _token) internal view returns (uint256) {
        if (_token == NATIVE) {
            return address(this).balance;
        } else {
            return IERC20(_token).balanceOf(address(this));
        }
    }
}