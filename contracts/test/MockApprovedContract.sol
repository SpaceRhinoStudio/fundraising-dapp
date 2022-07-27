/**
* MockApprovedContract.
* @author Mehdikovic
* Date created: 2022.04.28
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;


import "../fundraising/EngaToken.sol";

contract MockApprovedContract {

    EngaToken public enga;

    constructor(address _enga) {
        enga = EngaToken(_enga);
    }

    function transfer(address _user, uint256 amount) external {
        enga.transferFrom(_user, address(this), amount);
    }
}