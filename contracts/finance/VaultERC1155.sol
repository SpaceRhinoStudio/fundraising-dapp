/**
* ENGA Federation VaultERC1155.
* @author Mehdikovic
* Date created: 2022.05.03
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "../interfaces/finance/IVaultERC1155.sol";

abstract contract VaultERC1155 is IVaultERC1155 {
    /* VIEWS */

    function balanceERC1155(address _token, uint256 _id) external view returns (uint256) {
        return _balanceERC1155(_token, _id);
    }

    /* INTERNALS */

    function _depositERC1155(address _token, uint256 _id, uint256 _amount, bytes memory _data) internal {
        IERC1155(_token).safeTransferFrom(msg.sender, address(this), _id, _amount, _data);

        emit VaultDepositERC1155(_token, msg.sender, _id, _amount, _data);
    }

    function _batchDepositERC1155(address _token, uint256[] memory _ids, uint256[] memory _amounts, bytes memory _data) internal {
        IERC1155(_token).safeBatchTransferFrom(msg.sender,  address(this), _ids, _amounts, _data);

        emit VaultBatchDepositERC1155(_token, msg.sender, _ids, _amounts, _data);
    }

    function _transferERC1155(address _token, address _to, uint256 _id, uint256 _amount, bytes memory _data) internal {
        IERC1155(_token).safeTransferFrom(address(this), _to, _id, _amount, _data);

        emit VaultTransferERC1155(_token, _to, _id, _amount, _data);
    }

    function _batchTransferERC1155(address _token, address _to, uint256[] memory _ids, uint256[] memory _amounts, bytes memory _data) internal {
        IERC1155(_token).safeBatchTransferFrom(address(this), _to, _ids, _amounts, _data);

        emit VaultBatchTransferERC1155(_token, _to, _ids, _amounts, _data);
    }


    /* INTERNAL VIEWS */
    
    function _balanceERC1155(address _token, uint256 _id) internal view returns (uint256) {
        return IERC1155(_token).balanceOf(address(this), _id);
    }
}