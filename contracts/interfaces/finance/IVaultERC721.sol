/**
* ENGA Federation IVaultERC721.
* @author Mehdikovic
* Date created: 2022.05.03
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

interface IVaultERC721 {
    event VaultTransferERC721(address indexed token, address indexed to, uint256 tokenId, bytes data);
    event VaultDepositERC721(address indexed token, address indexed sender, uint256 tokenId, bytes data);
    
    function balanceERC721(address _token) external view returns (uint256);
    function depositERC721(address _token, uint256 _tokenId, bytes memory _data) external;
    function transferERC721(address _token, address _to, uint256 _tokenId, bytes memory _data) external;
}