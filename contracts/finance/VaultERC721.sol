/**
* ENGA Federation VaultERC721.
* @author Mehdikovic
* Date created: 2022.05.03
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "../interfaces/finance/IVaultERC721.sol";

abstract contract VaultERC721 is IVaultERC721 {
    /* VIEWS */

    function balanceERC721(address _token) external view returns (uint256) {
        return _balanceERC721(_token);
    }

    /* INTERNALS */

    function _depositERC721(address _token, uint256 _tokenId, bytes memory _data) internal {
        IERC721(_token).safeTransferFrom(msg.sender, address(this), _tokenId);
        emit VaultDepositERC721(_token, msg.sender, _tokenId, _data);
    }

    function _transferERC721(address _token, address _to, uint256 _tokenId, bytes memory _data) internal {
        IERC721(_token).safeTransferFrom(address(this), _to, _tokenId, _data);
        emit VaultTransferERC721(_token, _to, _tokenId, _data);
    }

    /* INTERNAL VIEWS */
    
    function _balanceERC721(address _token) internal view returns (uint256) {
        return IERC721(_token).balanceOf(address(this));
    }
}