/**
* ENGA Federation Market Maker Interface.
* @author Mehdikovic
* Date created: 2022.03.08
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

interface IMarketMaker {
    function initialize(uint256  _batchBlocks, uint256  _buyFeePct, uint256  _sellFeePct) external;
    function open() external;
    function suspend(bool _value) external;
    function updateBancorFormula(address _bancor) external;
    function updateTreasury(address _treasury) external;
    function updateFees(uint256 _buyFeePct, uint256 _sellFeePct) external;
    function addCollateralToken(address _collateral, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio, uint256 _slippage) external;
    function removeCollateralToken(address _collateral) external;
    function updateCollateralToken(address _collateral, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio, uint256 _slippage) external;
    function openBuyOrder(address _buyer, address _collateral, uint256 _value) external;
    function openSellOrder(address _seller, address _collateral, uint256 _amount) external;
    function claimBuyOrder(address _buyer, uint256 _batchId, address _collateral) external;
    function claimSellOrder(address _seller, uint256 _batchId, address _collateral) external;
    function claimCancelledBuyOrder(address _buyer, uint256 _batchId, address _collateral) external;
    function claimCancelledSellOrder(address _seller, uint256 _batchId, address _collateral) external;
    function collateralIsWhitelisted(address _collateral) external view returns (bool);
    function collateralsToBeClaimed(address _collateral) external view returns(uint256);
}