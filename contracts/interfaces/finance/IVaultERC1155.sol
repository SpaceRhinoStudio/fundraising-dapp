/**
* ENGA Federation IVaultERC1155.
* @author Mehdikovic
* Date created: 2022.05.03
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

interface IVaultERC1155 {
    event VaultDepositERC1155(address indexed token, address indexed sender, uint256 id, uint256 amount, bytes data);
    event VaultBatchDepositERC1155(address indexed token, address indexed sender, uint256[] ids, uint256[] amounts, bytes data);
    event VaultTransferERC1155(address indexed token, address indexed to, uint256 id, uint256 amount, bytes data);
    event VaultBatchTransferERC1155(address indexed token, address indexed to, uint256[] ids, uint256[] amounts, bytes data);
    
    function balanceERC1155(address _token, uint256 _id) external view returns (uint256);
    function depositERC1155(address _token, uint256 _id, uint256 _amount, bytes memory _data) external;
    function batchDepositERC1155(address _token, uint256[] memory _ids, uint256[] memory _amounts, bytes memory _data) external;
    function transferERC1155(address _token, address _to, uint256 _id, uint256 _amount, bytes memory _data) external;
    function batchTransferERC1155(address _token, address _to, uint256[] memory _ids, uint256[] memory _amounts, bytes memory _data) external;
}