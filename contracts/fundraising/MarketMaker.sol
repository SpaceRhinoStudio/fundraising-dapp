/**
* ENGA Federation MarketMaker.
* @author Aragon.org, Mehdikovic
* Date created: 2022.03.09
* Github: mehdikovic
* SPDX-License-Identifier: AGPL-3.0
*/

pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import { IMarketMaker } from "../interfaces/fundraising/IMarketMaker.sol";
import { IController } from "../interfaces/fundraising/IController.sol";
import { IBancor } from "../interfaces/fundraising/IBancor.sol";
import { ITokenManager } from "../interfaces/fundraising/ITokenManager.sol";
import { IVaultERC20 } from "../interfaces/finance/IVaultERC20.sol";
import { EngalandBase } from "../common/EngalandBase.sol";
import { TimeHelper } from "../common/TimeHelper.sol";
import { Utils } from "../lib/Utils.sol";


contract MarketMaker is IMarketMaker, EngalandBase, ReentrancyGuard, TimeHelper {
    using SafeERC20 for IERC20;

    uint256 public constant PCT_BASE = 10 ** 18; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    uint32  public constant PPM      = 1000000;

    string private constant ERROR_CONTRACT_IS_ZERO               = "MM_CONTRACT_IS_ZERO_ADDRESS";
    string private constant ERROR_INVALID_BATCH_BLOCKS           = "MM_INVALID_BATCH_BLOCKS";
    string private constant ERROR_INVALID_PERCENTAGE             = "MM_INVALID_PERCENTAGE";
    string private constant ERROR_INVALID_RESERVE_RATIO          = "MM_INVALID_RESERVE_RATIO";
    string private constant ERROR_INVALID_COLLATERAL             = "MM_INVALID_COLLATERAL";
    string private constant ERROR_INVALID_COLLATERAL_VALUE       = "MM_INVALID_COLLATERAL_VALUE";
    string private constant ERROR_INVALID_BOND_AMOUNT            = "MM_INVALID_BOND_AMOUNT";
    string private constant ERROR_ALREADY_OPEN                   = "MM_ALREADY_OPEN";
    string private constant ERROR_NOT_OPEN                       = "MM_NOT_OPEN";
    string private constant ERROR_MARKET_MAKER_SUSPENDED         = "MM_MARKET_MAKER_SUSPENDED";
    string private constant ERROR_CALLED_WTH_SAME_VALUE          = "MM_CALLED_WTH_SAME_VALUE";
    string private constant ERROR_COLLATERAL_ALREADY_WHITELISTED = "MM_COLLATERAL_ALREADY_WHITELISTED";
    string private constant ERROR_COLLATERAL_NOT_WHITELISTED     = "MM_COLLATERAL_NOT_WHITELISTED";
    string private constant ERROR_NOTHING_TO_CLAIM               = "MM_NOTHING_TO_CLAIM";
    string private constant ERROR_BATCH_NOT_OVER                 = "MM_BATCH_NOT_OVER";
    string private constant ERROR_BATCH_CANCELLED                = "MM_BATCH_CANCELLED";
    string private constant ERROR_BATCH_NOT_CANCELLED            = "MM_BATCH_NOT_CANCELLED";
    string private constant ERROR_SLIPPAGE_EXCEEDS_LIMIT         = "MM_SLIPPAGE_EXCEEDS_LIMIT";
    string private constant ERROR_INSUFFICIENT_POOL_BALANCE      = "MM_INSUFFICIENT_POOL_BALANCE";
    
    struct Collateral {
        bool    whitelisted;
        uint256 virtualSupply;
        uint256 virtualBalance;
        uint32  reserveRatio;
        uint256 slippage;
    }

    struct MetaBatch {
        bool           initialized;
        uint256        realSupply;
        uint256        buyFeePct;
        uint256        sellFeePct;
        IBancor        bancor;
        mapping(address => Batch) batches;
    }

    struct Batch {
        bool    initialized;
        bool    cancelled;
        uint256 supply;
        uint256 balance;
        uint32  reserveRatio;
        uint256 slippage;
        uint256 totalBuySpend;
        uint256 totalBuyReturn;
        uint256 totalSellSpend;
        uint256 totalSellReturn;
        mapping(address => uint256) buyers;
        mapping(address => uint256) sellers;
    }

    struct LightBatch {
        bool    initialized;
        bool    cancelled;
        uint256 supply;
        uint256 balance;
        uint32  reserveRatio;
        uint256 slippage;
        uint256 totalBuySpend;
        uint256 totalBuyReturn;
        uint256 totalSellSpend;
        uint256 totalSellReturn;
    }

    IController                    public controller; 
    ITokenManager                  public tokenManager;
    IERC20                         public engaToken;
    IBancor                        public bancor;
    IVaultERC20                    public reserve;
    address                        public treasury;

    uint256                        public batchBlocks;
    uint256                        public buyFeePct;
    uint256                        public sellFeePct;

    bool                           public isOpen;
    bool                           public isSuspended;
    uint256                        public tokensToBeMinted;
    mapping(address => uint256)    public collateralsToBeClaimed;
    mapping(address => Collateral) public collaterals;
    mapping(uint256 => MetaBatch)  public metaBatches;

    event UpdateTreasury(address indexed treasury);
    event UpdateBancorFormula(address indexed bancor);
    event UpdateFees(uint256 buyFeePct, uint256 sellFeePct);
    event NewMetaBatch(
        uint256 indexed id,
        uint256 supply,
        uint256 buyFeePct,
        uint256 sellFeePct,
        address bancor
    );
    event NewBatch(
        uint256 indexed id,
        address indexed collateral,
        uint256 supply,
        uint256 balance,
        uint32  reserveRatio,
        uint256 slippage
    );
    event CancelBatch(uint256 indexed id, address indexed collateral);
    event AddCollateralToken(
        address indexed collateral,
        uint256 virtualSupply,
        uint256 virtualBalance,
        uint32  reserveRatio,
        uint256 slippage
    );
    event RemoveCollateralToken(address indexed collateral);
    event UpdateCollateralToken(
        address indexed collateral,
        uint256 virtualSupply,
        uint256 virtualBalance,
        uint32  reserveRatio,
        uint256 slippage
    );
    event Open                   ();
    event Suspended              (bool value);
    event OpenBuyOrder           (address indexed buyer, uint256 indexed batchId, address indexed collateral, uint256 fee, uint256 value);
    event OpenSellOrder          (address indexed seller, uint256 indexed batchId, address indexed collateral, uint256 amount);
    event ClaimBuyOrder          (address indexed buyer, uint256 indexed batchId, address indexed collateral, uint256 amount);
    event ClaimSellOrder         (address indexed seller, uint256 indexed batchId, address indexed collateral, uint256 fee, uint256 value);
    event ClaimCancelledBuyOrder (address indexed buyer, uint256 indexed batchId, address indexed collateral, uint256 value);
    event ClaimCancelledSellOrder(address indexed seller, uint256 indexed batchId, address indexed collateral, uint256 amount);
    event UpdatePricing          (
        uint256 indexed batchId,
        address indexed collateral,
        uint256 totalBuySpend,
        uint256 totalBuyReturn,
        uint256 totalSellSpend,
        uint256 totalSellReturn
    );

    //solhint-disable-next-line
    constructor(address _controller) EngalandBase(_controller) {}

    /**
    * @notice Initialize market maker
    * @param _batchBlocks  the number of blocks batches are to last
    * @param _buyFeePct    the fee to be deducted from buy orders [in PCT_BASE]
    * @param _sellFeePct   the fee to be deducted from sell orders [in PCT_BASE]
    */
    function initialize(
        uint256  _batchBlocks,
        uint256  _buyFeePct,
        uint256  _sellFeePct
    ) 
        external
        onlyInitializer
    {
        _initialize();
        
        require(_batchBlocks > 0, ERROR_INVALID_BATCH_BLOCKS);
        require(_feeIsValid(_buyFeePct) && _feeIsValid(_sellFeePct), ERROR_INVALID_PERCENTAGE);

        controller   = IController(_msgSender());
        tokenManager = ITokenManager(controller.tokenManager());
        engaToken    = IERC20(controller.engaToken());
        reserve      = IVaultERC20(controller.reserve());
        bancor       = IBancor(controller.bancorFormula());
        treasury     = controller.treasury();
        batchBlocks  = _batchBlocks;
        buyFeePct    = _buyFeePct;
        sellFeePct   = _sellFeePct;
    }

    /***** STATE MODIFIERS *****/

    /**
    * @notice Open market making [enabling users to open buy and sell orders]
    */
    function open() external onlyInitialized onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!isOpen, ERROR_ALREADY_OPEN);

        _open();
    }

    /**
    * @notice Suspend buy and sell orders [disabling users from opening buy and sell orders]
    * @param _value a boolean indicates whether to suspend or resume
    */
    function suspend(bool _value) external onlyInitialized onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isOpen, ERROR_NOT_OPEN);
        require(isSuspended != _value, ERROR_CALLED_WTH_SAME_VALUE);

        _suspend(_value);
    }

    /**
    * @notice Update bancor to `_bancor`
    * @param _bancor The address of the new BancorFormula [computation] contract
    */
    function updateBancorFormula(address _bancor) external onlyInitialized onlyRole(DEFAULT_ADMIN_ROLE) {
        Utils.enforceHasContractCode(_bancor, ERROR_CONTRACT_IS_ZERO);

        _updateBancorFormula(_bancor);
    }

    /**
    * @notice Update treasury to `_treasury`
    * @param _treasury The address of the new treasury [to whom fees are to be sent]
    */
    function updateTreasury(address _treasury) external onlyInitialized onlyRole(DEFAULT_ADMIN_ROLE) {
        Utils.enforceHasContractCode(_treasury, ERROR_CONTRACT_IS_ZERO);

        _updateTreasury(_treasury);
    }

    /**
    * @notice Update fees deducted from buy and sell orders to respectively `@formatPct(_buyFeePct)`% and `@formatPct(_sellFeePct)`%
    * @param _buyFeePct  The new fee to be deducted from buy orders [in PCT_BASE]
    * @param _sellFeePct The new fee to be deducted from sell orders [in PCT_BASE]
    */
    function updateFees(uint256 _buyFeePct, uint256 _sellFeePct) external onlyInitialized onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feeIsValid(_buyFeePct) && _feeIsValid(_sellFeePct), ERROR_INVALID_PERCENTAGE);

        _updateFees(_buyFeePct, _sellFeePct);
    }

    /**
    * @notice Add `_collateral.symbol(): string` as a whitelisted collateral token
    * @param _collateral     The address of the collateral token to be whitelisted
    * @param _virtualSupply  The virtual supply to be used for that collateral token [in wei]
    * @param _virtualBalance The virtual balance to be used for that collateral token [in wei]
    * @param _reserveRatio   The reserve ratio to be used for that collateral token [in PPM]
    * @param _slippage       The price slippage below which each batch is to be kept for that collateral token [in PCT_BASE]
    */
    function addCollateralToken(address _collateral, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio, uint256 _slippage)
        external
        onlyInitialized
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        Utils.enforceHasContractCode(_collateral, ERROR_CONTRACT_IS_ZERO);
        require(!_collateralIsWhitelisted(_collateral), ERROR_COLLATERAL_ALREADY_WHITELISTED);
        require(_reserveRatioIsValid(_reserveRatio), ERROR_INVALID_RESERVE_RATIO);

        _addCollateralToken(_collateral, _virtualSupply, _virtualBalance, _reserveRatio, _slippage);
    }

    /**
    * @notice Remove `_collateral.symbol(): string` as a whitelisted collateral token
    * @param _collateral The address of the collateral token to be un-whitelisted
    */
    function removeCollateralToken(address _collateral) external onlyInitialized onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_collateralIsWhitelisted(_collateral), ERROR_COLLATERAL_NOT_WHITELISTED);

        _removeCollateralToken(_collateral);
    }

    /**
    * @notice Update `_collateral.symbol(): string` collateralization settings
    * @param _collateral     The address of the collateral token whose collateralization settings are to be updated
    * @param _virtualSupply  The new virtual supply to be used for that collateral token [in wei]
    * @param _virtualBalance The new virtual balance to be used for that collateral token [in wei]
    * @param _reserveRatio   The new reserve ratio to be used for that collateral token [in PPM]
    * @param _slippage       The new price slippage below which each batch is to be kept for that collateral token [in PCT_BASE]
    */
    function updateCollateralToken(address _collateral, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio, uint256 _slippage)
        external
        onlyInitialized
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_collateralIsWhitelisted(_collateral), ERROR_COLLATERAL_NOT_WHITELISTED);
        require(_reserveRatioIsValid(_reserveRatio),   ERROR_INVALID_RESERVE_RATIO);

        _updateCollateralToken(_collateral, _virtualSupply, _virtualBalance, _reserveRatio, _slippage);
    }
    
    /**
    * @notice Open a buy order worth `@tokenAmount(_collateral, _value)`
    * @param _collateral The address of the collateral token to be spent
    * @param _value      The amount of collateral token to be spent
    */
    function openBuyOrder(address _buyer, address _collateral, uint256 _value) external onlyInitialized onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isOpen, ERROR_NOT_OPEN);
        require(!isSuspended, ERROR_MARKET_MAKER_SUSPENDED);
        require(_collateralIsWhitelisted(_collateral), ERROR_COLLATERAL_NOT_WHITELISTED);
        require(!_batchIsCancelled(_currentBatchId(), _collateral), ERROR_BATCH_CANCELLED);
        require(_collateralValueIsValid(_buyer, _collateral, _value), ERROR_INVALID_COLLATERAL_VALUE);

        _openBuyOrder(_buyer, _collateral, _value);
    }

    /**
    * @notice Open a sell order worth `@tokenAmount(self.token(): address, _amount)` against `_collateral.symbol(): string`
    * @param _collateral The address of the collateral token to be returned
    * @param _amount     The amount of bonded token to be spent
    */
    function openSellOrder(address _seller, address _collateral, uint256 _amount) external onlyInitialized onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isOpen, ERROR_NOT_OPEN);
        require(!isSuspended, ERROR_MARKET_MAKER_SUSPENDED);
        require(_collateralIsWhitelisted(_collateral), ERROR_COLLATERAL_NOT_WHITELISTED);
        require(!_batchIsCancelled(_currentBatchId(), _collateral), ERROR_BATCH_CANCELLED);
        require(_bondAmountIsValid(_seller, _amount), ERROR_INVALID_BOND_AMOUNT);

        _openSellOrder(_seller, _collateral, _amount);
    }

    /**
    * @notice Claim the results of `_buyer`'s `_collateral.symbol(): string` buy orders from batch #`_batchId`
    * @param _buyer      The address of the user whose buy orders are to be claimed
    * @param _batchId    The id of the batch in which buy orders are to be claimed
    * @param _collateral The address of the collateral token against which buy orders are to be claimed
    */
    function claimBuyOrder(address _buyer, uint256 _batchId, address _collateral) external onlyInitialized nonReentrant {
        require(_collateralIsWhitelisted(_collateral),       ERROR_COLLATERAL_NOT_WHITELISTED);
        require(_batchIsOver(_batchId),                      ERROR_BATCH_NOT_OVER);
        require(!_batchIsCancelled(_batchId, _collateral),   ERROR_BATCH_CANCELLED);
        require(_userIsBuyer(_batchId, _collateral, _buyer), ERROR_NOTHING_TO_CLAIM);

        _claimBuyOrder(_buyer, _batchId, _collateral);
    }

    /**
    * @notice Claim the results of `_seller`'s `_collateral.symbol(): string` sell orders from batch #`_batchId`
    * @param _seller     The address of the user whose sell orders are to be claimed
    * @param _batchId    The id of the batch in which sell orders are to be claimed
    * @param _collateral The address of the collateral token against which sell orders are to be claimed
    */
    function claimSellOrder(address _seller, uint256 _batchId, address _collateral) external onlyInitialized nonReentrant {
        require(_collateralIsWhitelisted(_collateral),         ERROR_COLLATERAL_NOT_WHITELISTED);
        require(_batchIsOver(_batchId),                        ERROR_BATCH_NOT_OVER);
        require(!_batchIsCancelled(_batchId, _collateral),     ERROR_BATCH_CANCELLED);
        require(_userIsSeller(_batchId, _collateral, _seller), ERROR_NOTHING_TO_CLAIM);

        _claimSellOrder(_seller, _batchId, _collateral);
    }

    /**
    * @notice Claim the investments of `_buyer`'s `_collateral.symbol(): string` buy orders from cancelled batch #`_batchId`
    * @param _buyer      The address of the user whose cancelled buy orders are to be claimed
    * @param _batchId    The id of the batch in which cancelled buy orders are to be claimed
    * @param _collateral The address of the collateral token against which cancelled buy orders are to be claimed
    */
    function claimCancelledBuyOrder(address _buyer, uint256 _batchId, address _collateral) external onlyInitialized nonReentrant {
        require(_batchIsCancelled(_batchId, _collateral),    ERROR_BATCH_NOT_CANCELLED);
        require(_userIsBuyer(_batchId, _collateral, _buyer), ERROR_NOTHING_TO_CLAIM);

        _claimCancelledBuyOrder(_buyer, _batchId, _collateral);
    }

    /**
    * @notice Claim the investments of `_seller`'s `_collateral.symbol(): string` sell orders from cancelled batch #`_batchId`
    * @param _seller     The address of the user whose cancelled sell orders are to be claimed
    * @param _batchId    The id of the batch in which cancelled sell orders are to be claimed
    * @param _collateral The address of the collateral token against which cancelled sell orders are to be claimed
    */
    function claimCancelledSellOrder(address _seller, uint256 _batchId, address _collateral) external onlyInitialized nonReentrant {
        require(_batchIsCancelled(_batchId, _collateral),      ERROR_BATCH_NOT_CANCELLED);
        require(_userIsSeller(_batchId, _collateral, _seller), ERROR_NOTHING_TO_CLAIM);

        _claimCancelledSellOrder(_seller, _batchId, _collateral);
    }

    /***** PUBLIC VIEW *****/

    function collateralIsWhitelisted(address _collateral) external view returns (bool) {
        return _collateralIsWhitelisted(_collateral);
    }
    
    function getCurrentBatchId() external view returns (uint256) {
        return _currentBatchId();
    }

    function getCollateralToken(address _collateral) external view returns (Collateral memory) {
        return collaterals[_collateral];
    }

    function getBatch(uint256 _batchId, address _collateral)
        external view
        returns (LightBatch memory)
    {
        Batch storage batch = metaBatches[_batchId].batches[_collateral];
        return LightBatch(
            batch.initialized,
            batch.cancelled,
            batch.supply,
            batch.balance,
            batch.reserveRatio,
            batch.slippage,
            batch.totalBuySpend,
            batch.totalBuyReturn,
            batch.totalSellSpend,
            batch.totalSellReturn
        );
    }
 
    function getStaticPricePPM(uint256 _supply, uint256 _balance, uint32 _reserveRatio) external pure returns (uint256) {
        return _staticPricePPM(_supply, _balance, _reserveRatio);
    }

    function getDynamicPricePPM(address _collateral) external view returns (uint256) {
        require(collaterals[_collateral].whitelisted, ERROR_COLLATERAL_NOT_WHITELISTED);
        
        uint256 supply = engaToken.totalSupply() + tokensToBeMinted + collaterals[_collateral].virtualSupply;
        uint256 balance = _reserveBalance(_collateral) + collaterals[_collateral].virtualBalance - collateralsToBeClaimed[_collateral]; 
        uint32 reserveRatio = collaterals[_collateral].reserveRatio;

        return _staticPricePPM(supply, balance, reserveRatio);
    }

    /***** INTERNALS *****/

    function _staticPricePPM(uint256 _supply, uint256 _balance, uint32 _reserveRatio) internal pure returns (uint256) {
        return (uint256(PPM) * uint256(PPM) * _balance) / (_supply * uint256(_reserveRatio));
    }

    function _currentBatchId() internal view returns (uint256) {
        return getBatchId(batchBlocks);
    }

    /* CHECKS */

    function _feeIsValid(uint256 _fee) internal pure returns (bool) {
        return 0 <= _fee && _fee <= PCT_BASE;
    }

    function _reserveRatioIsValid(uint32 _reserveRatio) internal pure returns (bool) {
        return 0 < _reserveRatio && _reserveRatio <= PPM;
    }

    function _collateralValueIsValid(address _buyer, address _collateral, uint256 _value) internal view returns (bool) {
        if (_value == 0) {
            return false;
        }

        return (
            _balanceOf(_buyer, _collateral) >= _value &&
            IERC20(_collateral).allowance(_buyer, address(this)) >= _value
        );
    }

    function _bondAmountIsValid(address _seller, uint256 _amount) internal view returns (bool) {
        return _amount != 0 && _balanceOf(_seller, address(engaToken)) >= _amount;
    }

    function _collateralIsWhitelisted(address _collateral) internal view returns (bool) {
        return collaterals[_collateral].whitelisted;
    }

    function _batchIsOver(uint256 _batchId) internal view returns (bool) {
        return _batchId < _currentBatchId();
    }

    function _batchIsCancelled(uint256 _batchId, address _collateral) internal view returns (bool) {
        return metaBatches[_batchId].batches[_collateral].cancelled;
    }

    function _userIsBuyer(uint256 _batchId, address _collateral, address _user) internal view returns (bool) {
        Batch storage batch = metaBatches[_batchId].batches[_collateral];
        return batch.buyers[_user] > 0;
    }

    function _userIsSeller(uint256 _batchId, address _collateral, address _user) internal view returns (bool) {
        Batch storage batch = metaBatches[_batchId].batches[_collateral];
        return batch.sellers[_user] > 0;
    }

    function _poolBalanceIsSufficient(address _collateral) internal view returns (bool) {
        return _reserveBalance(_collateral) >= collateralsToBeClaimed[_collateral];
    }

    function _slippageIsValid(Batch storage _batch) internal view returns (bool) {
        uint256 staticPricePPM = _staticPricePPM(_batch.supply, _batch.balance, _batch.reserveRatio);
        uint256 maximumSlippage = _batch.slippage;

        // if static price is zero let's consider that every slippage is valid
        if (staticPricePPM == 0) {
            return true;
        }

        return _buySlippageIsValid(_batch, staticPricePPM, maximumSlippage) && _sellSlippageIsValid(_batch, staticPricePPM, maximumSlippage);
    }
    
    function _buySlippageIsValid(Batch storage _batch, uint256 _startingPricePPM, uint256 _maximumSlippage) internal view returns (bool) {
        /**
         * NOTE
         * the case where starting price is zero is handled
         * in the meta function _slippageIsValid()
        */

        /**
         * NOTE
         * slippage is valid if:
         * totalBuyReturn >= totalBuySpend / (startingPrice * (1 + maxSlippage))
         * totalBuyReturn >= totalBuySpend / ((startingPricePPM / PPM) * (1 + maximumSlippage / PCT_BASE))
         * totalBuyReturn >= totalBuySpend / ((startingPricePPM / PPM) * (1 + maximumSlippage / PCT_BASE))
         * totalBuyReturn >= totalBuySpend / ((startingPricePPM / PPM) * (PCT + maximumSlippage) / PCT_BASE)
         * totalBuyReturn * startingPrice * ( PCT + maximumSlippage) >= totalBuySpend * PCT_BASE * PPM
        */
        if (
            _batch.totalBuyReturn * _startingPricePPM * (PCT_BASE + _maximumSlippage) >=
            _batch.totalBuySpend * PCT_BASE * uint256(PPM)
        ) {
            return true;
        }

        return false;
    }

    function _sellSlippageIsValid(Batch storage _batch, uint256 _startingPricePPM, uint256 _maximumSlippage) internal view returns (bool) {
        /**
         * NOTE
         * the case where starting price is zero is handled
         * in the meta function _slippageIsValid()
        */

        // if allowed sell slippage >= 100%
        // then any sell slippage is valid
        if (_maximumSlippage >= PCT_BASE) {
            return true;
        }

        /**
         * NOTE
         * slippage is valid if
         * totalSellReturn >= startingPrice * (1 - maxSlippage) * totalBuySpend
         * totalSellReturn >= (startingPricePPM / PPM) * (1 - maximumSlippage / PCT_BASE) * totalBuySpend
         * totalSellReturn >= (startingPricePPM / PPM) * (PCT_BASE - maximumSlippage) * totalBuySpend / PCT_BASE
         * totalSellReturn * PCT_BASE * PPM = startingPricePPM * (PCT_BASE - maximumSlippage) * totalBuySpend
        */

        if (
            _batch.totalSellReturn * PCT_BASE * uint256(PPM) >=
            _startingPricePPM * (PCT_BASE - _maximumSlippage) * _batch.totalSellSpend
        ) {
            return true;
        }

        return false;
    }

    /*** STATE MODIFIERS ***/
    
    function _currentBatch(address _collateral) internal returns (uint256, Batch storage) {
        uint256 batchId = _currentBatchId();
        MetaBatch storage metaBatch = metaBatches[batchId];
        Batch storage batch = metaBatch.batches[_collateral];

        if (!metaBatch.initialized) {
            /**
             * NOTE
             * all collateral batches should be initialized with the same supply to
             * avoid price manipulation between different collaterals in the same meta-batch
             * we don't need to do the same with collateral balances as orders against one collateral
             * can't affect the pool's balance against another collateral and tap is a step-function
             * of the meta-batch duration
            */

            /**
             * NOTE
             * realSupply(metaBatch) = totalSupply(metaBatchInitialization) + tokensToBeMinted(metaBatchInitialization)
             * 1. buy and sell orders incoming during the current meta-batch and affecting totalSupply or tokensToBeMinted
             * should not be taken into account in the price computation [they are already a part of the batched pricing computation]
             * 2. the only way for totalSupply to be modified during a meta-batch [outside of incoming buy and sell orders]
             * is for buy orders from previous meta-batches to be claimed [and tokens to be minted]:
             * as such totalSupply(metaBatch) + tokenToBeMinted(metaBatch) will always equal totalSupply(metaBatchInitialization) + tokenToBeMinted(metaBatchInitialization)
            */
            metaBatch.realSupply = engaToken.totalSupply() + tokensToBeMinted;
            metaBatch.buyFeePct = buyFeePct;
            metaBatch.sellFeePct = sellFeePct;
            metaBatch.bancor = bancor;
            metaBatch.initialized = true;

            emit NewMetaBatch(batchId, metaBatch.realSupply, metaBatch.buyFeePct, metaBatch.sellFeePct, address(metaBatch.bancor));
        }

        if (!batch.initialized) {
            /**
             * NOTE
             * supply(batch) = realSupply(metaBatch) + virtualSupply(batchInitialization)
             * virtualSupply can technically be updated during a batch: the on-going batch will still use
             * its value at the time of initialization [it's up to the updater to act wisely]
            */

            /**
             * NOTE
             * balance(batch) = poolBalance(batchInitialization) - collateralsToBeClaimed(batchInitialization) + virtualBalance(metaBatchInitialization)
             * 1. buy and sell orders incoming during the current batch and affecting poolBalance or collateralsToBeClaimed
             * should not be taken into account in the price computation [they are already a part of the batched price computation]
             * 2. the only way for poolBalance to be modified during a batch [outside of incoming buy and sell orders]
             * is for sell orders from previous meta-batches to be claimed [and collateral to be transfered] as the tap is a step-function of the meta-batch duration:
             * as such poolBalance(batch) - collateralsToBeClaimed(batch) will always equal poolBalance(batchInitialization) - collateralsToBeClaimed(batchInitialization)
             * 3. virtualBalance can technically be updated during a batch: the on-going batch will still use
             * its value at the time of initialization [it's up to the updater to act wisely]
            */
            controller.updateTappedAmount(_collateral);
            
            batch.supply = metaBatch.realSupply + collaterals[_collateral].virtualSupply;
            batch.balance = _reserveBalance(_collateral) + collaterals[_collateral].virtualBalance - collateralsToBeClaimed[_collateral];
            batch.reserveRatio = collaterals[_collateral].reserveRatio;
            batch.slippage = collaterals[_collateral].slippage;
            batch.initialized = true;

            emit NewBatch(batchId, _collateral, batch.supply, batch.balance, batch.reserveRatio, batch.slippage);
        }

        return (batchId, batch);
    }

    function _open() internal {
        isOpen = true;

        emit Open();
    }

    function _suspend(bool _value) internal {
        isSuspended = _value;

        emit Suspended(_value);
    }

    function _updateTreasury(address _treasury) internal {
        treasury = _treasury;

        emit UpdateTreasury(_treasury);
    }

    function _updateBancorFormula(address _bancor) internal {
        bancor = IBancor(_bancor);

        emit UpdateBancorFormula(address(_bancor));
    }

    function _updateFees(uint256 _buyFeePct, uint256 _sellFeePct) internal {
        buyFeePct = _buyFeePct;
        sellFeePct = _sellFeePct;

        emit UpdateFees(_buyFeePct, _sellFeePct);
    }

    function _cancelCurrentBatch(address _collateral) internal {
        (uint256 batchId, Batch storage batch) = _currentBatch(_collateral);
        if (!batch.cancelled) {
            batch.cancelled = true;

            // bought bonds are cancelled but sold bonds are due back
            // bought collaterals are cancelled but sold collaterals are due back
            tokensToBeMinted = tokensToBeMinted - batch.totalBuyReturn + batch.totalSellSpend;
            collateralsToBeClaimed[_collateral] = collateralsToBeClaimed[_collateral] + batch.totalBuySpend - batch.totalSellReturn;

            emit CancelBatch(batchId, _collateral);
        }
    }

    function _addCollateralToken(address _collateral, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio, uint256 _slippage)
        internal
    {
        collaterals[_collateral].whitelisted = true;
        collaterals[_collateral].virtualSupply = _virtualSupply;
        collaterals[_collateral].virtualBalance = _virtualBalance;
        collaterals[_collateral].reserveRatio = _reserveRatio;
        collaterals[_collateral].slippage = _slippage;

        emit AddCollateralToken(_collateral, _virtualSupply, _virtualBalance, _reserveRatio, _slippage);
    }

    function _removeCollateralToken(address _collateral) internal {
        _cancelCurrentBatch(_collateral);

        Collateral storage collateral = collaterals[_collateral];
        delete collateral.whitelisted;
        delete collateral.virtualSupply;
        delete collateral.virtualBalance;
        delete collateral.reserveRatio;
        delete collateral.slippage;

        emit RemoveCollateralToken(_collateral);
    }

    function _updateCollateralToken(
        address _collateral,
        uint256 _virtualSupply,
        uint256 _virtualBalance,
        uint32  _reserveRatio,
        uint256 _slippage
    )
        internal
    {
        collaterals[_collateral].virtualSupply = _virtualSupply;
        collaterals[_collateral].virtualBalance = _virtualBalance;
        collaterals[_collateral].reserveRatio = _reserveRatio;
        collaterals[_collateral].slippage = _slippage;

        emit UpdateCollateralToken(_collateral, _virtualSupply, _virtualBalance, _reserveRatio, _slippage);
    }

    function _openBuyOrder(address _buyer, address _collateral, uint256 _value) internal {
        (uint256 batchId, Batch storage batch) = _currentBatch(_collateral);

        // deduct fee
        uint256 fee = (_value * metaBatches[batchId].buyFeePct) / PCT_BASE;
        uint256 value = _value - fee;

        // collect fee and collateral
        if (fee > 0) {
            _transfer(_buyer, treasury, _collateral, fee);
        }
        _transfer(_buyer, address(reserve), _collateral, value);

        // save batch
        uint256 deprecatedBuyReturn = batch.totalBuyReturn;
        uint256 deprecatedSellReturn = batch.totalSellReturn;

        // update batch
        batch.totalBuySpend += value;
        batch.buyers[_buyer] += value;

        // update pricing
        _updatePricing(batch, batchId, _collateral);

        // update the amount of tokens to be minted and collaterals to be claimed
        tokensToBeMinted = tokensToBeMinted - deprecatedBuyReturn + batch.totalBuyReturn;
        collateralsToBeClaimed[_collateral] = collateralsToBeClaimed[_collateral] - deprecatedSellReturn + batch.totalSellReturn;

        // sanity checks
        require(_slippageIsValid(batch), ERROR_SLIPPAGE_EXCEEDS_LIMIT);

        emit OpenBuyOrder(_buyer, batchId, _collateral, fee, value);
    }

    function _openSellOrder(address _seller, address _collateral, uint256 _amount) internal {
        (uint256 batchId, Batch storage batch) = _currentBatch(_collateral);

        // burn bonds
        tokenManager.burn(_seller, _amount);

        // save batch
        uint256 deprecatedBuyReturn = batch.totalBuyReturn;
        uint256 deprecatedSellReturn = batch.totalSellReturn;

        // update batch
        batch.totalSellSpend += _amount;
        batch.sellers[_seller] += _amount;

        // update pricing
        _updatePricing(batch, batchId, _collateral);

        // update the amount of tokens to be minted and collaterals to be claimed
        tokensToBeMinted = tokensToBeMinted - deprecatedBuyReturn + batch.totalBuyReturn;
        collateralsToBeClaimed[_collateral] = collateralsToBeClaimed[_collateral] - deprecatedSellReturn + batch.totalSellReturn;

        // sanity checks
        require(_slippageIsValid(batch), ERROR_SLIPPAGE_EXCEEDS_LIMIT);
        require(_poolBalanceIsSufficient(_collateral), ERROR_INSUFFICIENT_POOL_BALANCE);

        emit OpenSellOrder(_seller, batchId, _collateral, _amount);
    }

    function _claimBuyOrder(address _buyer, uint256 _batchId, address _collateral) internal {
        Batch storage batch = metaBatches[_batchId].batches[_collateral];
        uint256 buyReturn = (batch.buyers[_buyer] * batch.totalBuyReturn) / batch.totalBuySpend;

        batch.buyers[_buyer] = 0;

        if (buyReturn > 0) {
            tokensToBeMinted = tokensToBeMinted - buyReturn;
            tokenManager.mint(_buyer, buyReturn);
        }

        emit ClaimBuyOrder(_buyer, _batchId, _collateral, buyReturn);
    }

    function _claimSellOrder(address _seller, uint256 _batchId, address _collateral) internal {
        Batch storage batch = metaBatches[_batchId].batches[_collateral];
        uint256 saleReturn = (batch.sellers[_seller] * batch.totalSellReturn) / batch.totalSellSpend;
        uint256 fee = (saleReturn * metaBatches[_batchId].sellFeePct) / PCT_BASE;
        uint256 value = saleReturn - fee;

        batch.sellers[_seller] = 0;

        if (value > 0) {
            collateralsToBeClaimed[_collateral] -= saleReturn;
            reserve.transferERC20(_collateral, _seller, value);
        }
        if (fee > 0) {
            reserve.transferERC20(_collateral, treasury, fee);
        }

        emit ClaimSellOrder(_seller, _batchId, _collateral, fee, value);
    }

    function _claimCancelledBuyOrder(address _buyer, uint256 _batchId, address _collateral) internal {
        Batch storage batch = metaBatches[_batchId].batches[_collateral];

        uint256 value = batch.buyers[_buyer];
        batch.buyers[_buyer] = 0;

        if (value > 0) {
            collateralsToBeClaimed[_collateral] -= value;
            reserve.transferERC20(_collateral, _buyer, value);
        }

        emit ClaimCancelledBuyOrder(_buyer, _batchId, _collateral, value);
    }

    function _claimCancelledSellOrder(address _seller, uint256 _batchId, address _collateral) internal {
        Batch storage batch = metaBatches[_batchId].batches[_collateral];

        uint256 amount = batch.sellers[_seller];
        batch.sellers[_seller] = 0;

        if (amount > 0) {
            tokensToBeMinted -= amount;
            tokenManager.mint(_seller, amount);
        }

        emit ClaimCancelledSellOrder(_seller, _batchId, _collateral, amount);
    }
    
    function _updatePricing(Batch storage batch, uint256 _batchId, address _collateral) internal {
        // the situation where there are no buy nor sell orders can't happen [keep commented]
        // if (batch.totalSellSpend == 0 && batch.totalBuySpend == 0)
        //     return;

        // static price is the current exact price in collateral
        // per token according to the initial state of the batch
        // [expressed in PPM for precision sake]
        uint256 staticPricePPM = _staticPricePPM(batch.supply, batch.balance, batch.reserveRatio);

        // [NOTE]
        // if staticPrice is zero then resultOfSell [= 0] <= batch.totalBuySpend
        // so totalSellReturn will be zero and totalBuyReturn will be
        // computed normally along the bancor

        // 1. we want to find out if buy orders are worth more sell orders [or vice-versa]
        // 2. we thus check the return of sell orders at the current exact price
        // 3. if the return of sell orders is larger than the pending buys,
        //    there are more sells than buys [and vice-versa]
        uint256 resultOfSell = (batch.totalSellSpend * staticPricePPM) / uint256(PPM);

        if (resultOfSell > batch.totalBuySpend) {
            // >> sell orders are worth more than buy orders

            // 1. first we execute all pending buy orders at the current exact
            // price because there is at least one sell order for each buy order
            // 2. then the final sell return is the addition of this first
            // matched return with the remaining bonding curve return

            // the number of tokens bought as a result of all buy orders matched at the
            // current exact price [which is less than the total amount of tokens to be sold]
            batch.totalBuyReturn = (batch.totalBuySpend * uint256(PPM)) / staticPricePPM;
            // the number of tokens left over to be sold along the curve which is the difference
            // between the original total sell order and the result of all the buy orders
            uint256 remainingSell = batch.totalSellSpend - batch.totalBuyReturn;
            // the amount of collateral generated by selling tokens left over to be sold
            // along the bonding curve in the batch initial state [as if the buy orders
            // never existed and the sell order was just smaller than originally thought]
            uint256 remainingSellReturn = metaBatches[_batchId].bancor.calculateSaleReturn(batch.supply, batch.balance, batch.reserveRatio, remainingSell);
            // the total result of all sells is the original amount of buys which were matched
            // plus the remaining sells which were executed along the bonding curve
            batch.totalSellReturn = batch.totalBuySpend+ remainingSellReturn;
        } else {
            // >> buy orders are worth more than sell orders

            // 1. first we execute all pending sell orders at the current exact
            // price because there is at least one buy order for each sell order
            // 2. then the final buy return is the addition of this first
            // matched return with the remaining bonding curve return

            // the number of collaterals bought as a result of all sell orders matched at the
            // current exact price [which is less than the total amount of collateral to be spent]
            batch.totalSellReturn = resultOfSell;
            // the number of collaterals left over to be spent along the curve which is the difference
            // between the original total buy order and the result of all the sell orders
            uint256 remainingBuy = batch.totalBuySpend - resultOfSell;
            // the amount of tokens generated by selling collaterals left over to be spent
            // along the bonding curve in the batch initial state [as if the sell orders
            // never existed and the buy order was just smaller than originally thought]
            uint256 remainingBuyReturn = metaBatches[_batchId].bancor.calculatePurchaseReturn(batch.supply, batch.balance, batch.reserveRatio, remainingBuy);
            // the total result of all buys is the original amount of buys which were matched
            // plus the remaining buys which were executed along the bonding curve
            batch.totalBuyReturn = batch.totalSellSpend + remainingBuyReturn;
        }


        emit UpdatePricing(_batchId, _collateral, batch.totalBuySpend, batch.totalBuyReturn, batch.totalSellSpend, batch.totalSellReturn);
    }

    function _transfer(address _from, address _to, address _collateralToken, uint256 _amount) internal {
        IERC20(_collateralToken).safeTransferFrom(_from, _to, _amount);
    }

    function _balanceOf(address _who, address _token) internal view returns (uint256) {
        return IERC20(_token).balanceOf(address(_who));
    }

    function _reserveBalance(address _collateral) internal view returns (uint256) {
        return _balanceOf(address(reserve), _collateral) - controller.getMaximumWithdrawal(_collateral);
    }
}