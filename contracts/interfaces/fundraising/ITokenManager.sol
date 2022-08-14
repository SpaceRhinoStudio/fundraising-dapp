/**
* ENGA Federation Token Manager Interface.
* @author Mehdikovic
* Date created: 2022.03.03
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

interface ITokenManager {
    function initialize(address _team,address _seedSale) external;
    function closeVestingProcess() external;
    function mint(address _receiver, uint256 _amount) external;
    function burn(address _burner, uint256 _amount) external;
    function createVesting(address _beneficiary, address _vestingCreator, uint256 _amount, uint256 _start, uint256 _cliff, uint256 _end, bool _revocable) external returns (bytes32 vestingId);
    function revoke(bytes32 vestingId) external;
    function release(bytes32 vestingId) external;
    function withdraw(address _token, address _receiver, uint256 _amount) external;
    function getVestingOwner(bytes32 vestingId) external view returns(address);
    function isVestingClosed() external view returns(bool);
    function getEngaToken() external view returns(address);
}