/**
* ENGA Federation IKycAuthorization contract.
* @author Mehdikovic
* Date created: 2022.03.23
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;


interface IKycAuthorization {
    function enableKyc() external;
    function disableKyc() external;
    function addKycUser(address _user) external;
    function removeKycUser(address _user) external;
    function getKycOfUser(address _user) external view returns (bool isKyc);
}