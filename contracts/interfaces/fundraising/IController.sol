/**
* ENGA Federation Controller Interface.
* @author Mehdikovic
* Date created: 2022.04.05
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

interface IController {
    enum ControllerState {
        Constructed,
        ContractsDeployed,
        Initialized
    }
    
    function setNewSaleAddress(address _newSale) external;
    
    function state() external view returns (ControllerState);
    function engaToken() external view returns(address);
    function tokenManager() external view returns(address);
    function marketMaker() external view returns(address);
    function bancorFormula() external view returns(address);
    function beneficiary() external view returns(address);
    function tap() external view returns(address);
    function reserve() external view returns(address);
    function treasury() external view returns(address);
    function kyc() external view returns(address);
    //function preSale() external view returns(address);

    /************************************/
    /**** PRESALE SPECIFIC INTERFACE ****/
    /************************************/
    function closeSale() external;
    function openSaleByDate(uint256 _openDate) external;
    function openSaleNow() external;
    function contribute(uint256 _value) external;
    function refund(address _contributor, bytes32 _vestedPurchaseId) external;
    
    /************************************/
    /****** KYC SPECIFIC INTERFACE ******/
    /************************************/
    function enableKyc() external;
    function disableKyc() external;
    function addKycUser(address _user) external;
    function removeKycUser(address _user) external;
    function getKycOfUser(address _user) external view returns (bool);

    /************************************/
    /*** Treasury SPECIFIC INTERFACE ****/
    /************************************/
    function treasuryTransfer(address _token, address _to, uint256 _value) external;

    /************************************/
    /* TokenManager SPECIFIC INTERFACE **/
    /************************************/
    function createVesting(address _beneficiary, uint256 _amount, uint256 _start, uint256 _cliff, uint256 _end, bool _revocable) external returns (bytes32);
    function revoke(bytes32 vestingId) external;
    function release(bytes32 vestingId) external;
    function closeVestingProcess() external;
    function withdrawTokenManger(address _token, address _receiver, uint256 _amount) external;

    /************************************/
    /** MarketMaker SPECIFIC INTERFACE **/
    /************************************/
    function collateralsToBeClaimed(address _collateral) external view returns(uint256);
    function openPublicTrading(address[] memory collaterals) external;
    function suspendMarketMaker(bool _value) external;
    function updateBancorFormula(address _bancor) external;
    function updateTreasury(address payable _treasury) external;
    function updateFees(uint256 _buyFeePct, uint256 _sellFeePct) external;
    function addCollateralToken(address _collateral, uint256 _virtualSupply, uint256 _virtualBalance, uint32  _reserveRatio, uint256 _slippage, uint256 _rate, uint256 _floor) external;
    function reAddCollateralToken(address _collateral, uint256 _virtualSupply, uint256 _virtualBalance, uint32  _reserveRatio, uint256 _slippage) external;
    function removeCollateralToken(address _collateral) external;
    function updateCollateralToken(address _collateral, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio, uint256 _slippage) external;
    function openBuyOrder(address _collateral, uint256 _value) external;
    function openSellOrder(address _collateral, uint256 _amount) external;
    function claimBuyOrder(address _buyer, uint256 _batchId, address _collateral) external;
    function claimSellOrder(address _seller, uint256 _batchId, address _collateral) external;
    function claimCancelledBuyOrder(address _buyer, uint256 _batchId, address _collateral) external;
    function claimCancelledSellOrder(address _seller, uint256 _batchId, address _collateral) external;

    /************************************/
    /****** TAP SPECIFIC INTERFACE ******/
    /************************************/
    function updateBeneficiary(address payable _beneficiary) external;
    function updateMaximumTapRateIncreasePct(uint256 _maximumTapRateIncreasePct) external;
    function updateMaximumTapFloorDecreasePct(uint256 _maximumTapFloorDecreasePct) external;
    function removeTappedToken(address _token) external;
    function updateTappedToken(address _token, uint256 _rate, uint256 _floor) external;
    function updateTappedAmount(address _token) external;
    function withdrawTap(address _collateral) external;
    function getMaximumWithdrawal(address _token) external view returns (uint256);
}