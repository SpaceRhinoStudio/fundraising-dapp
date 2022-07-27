/**
* ENGA Federation TimeHelper.
* @author Mehdikovic
* Date created: 2022.03.08
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

/** NOTE 
* functions are marked as virtual to let tests be written 
* more easily with mock contracts as their parent contracts 
*/

pragma solidity ^0.8.0;

contract TimeHelper {
    function getTimeNow() internal virtual view returns(uint256) {
        return block.timestamp;
    }

    function getBlockNumber() internal virtual view returns(uint256) {
        return block.number;
    }

    function getBatchId(uint256 batchBlocks) internal virtual view returns (uint256) {
        return (block.number / batchBlocks) * batchBlocks;
    }
}