/**
* ENGA Federation Utility contract.
* @author Mehdikovic
* Date created: 2022.03.01
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

library Utils {
    function getSig(string memory _fullSignature) internal pure returns(bytes4 _sig) {
        _sig = bytes4(keccak256(bytes(_fullSignature)));
    }

    function transferNativeToken(address _to, uint256 _value) internal returns (bool) {
        // solhint-disable avoid-low-level-calls
        (bool sent, ) = payable(_to).call{value: _value}("");
        return sent;
    }

    function enforceHasContractCode(address _target, string memory _errorMsg) internal view {
        require(_target != address(0), _errorMsg);

        uint256 size;
        // solhint-disable-next-line
        assembly { size := extcodesize(_target) }
        require(size > 0, _errorMsg);
    }

    function enforceValidAddress(address _target, string memory _errorMsg) internal pure {
        require(_target != address(0), _errorMsg);
    }
}