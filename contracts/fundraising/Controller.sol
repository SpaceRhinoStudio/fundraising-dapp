/**
* ENGA Federation Controller.
* @author Mehdikovic
* Date created: 2022.04.05
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

import { IController } from "../interfaces/fundraising/IController.sol";
import { EngalandBase } from "../common/EngalandBase.sol";

import { IEngaToken } from "../interfaces/fundraising/IEngaToken.sol";
import { ITokenManager } from "../interfaces/fundraising/ITokenManager.sol";
import { IMarketMaker } from "../interfaces/fundraising/IMarketMaker.sol";
import { IBancor } from "../interfaces/fundraising/IBancor.sol";
import { ITap } from "../interfaces/fundraising/ITap.sol";
import { IVaultERC20 } from "../interfaces/finance/IVaultERC20.sol";
import { IKycAuthorization } from "../interfaces/access/IKycAuthorization.sol";
import { IPreSale, SaleState } from "../interfaces/fundraising/IPreSale.sol";
import { IPaymentSplitter } from "../interfaces/finance/IPaymentSplitter.sol";

import { EngalandAccessControl } from "../access/EngalandAccessControl.sol";
import { Utils } from "../lib/Utils.sol";


contract Controller is IController, EngalandAccessControl {
    /**
    bytes32 public constant MINTER_ROLE                                = keccak256("MINTER_ROLE");;
    bytes32 public constant BURNER_ROLE                                = keccak256("BURNER_ROLE");;
    bytes32 public constant SUSPEND_ROLE                               = keccak256("SUSPEND_ROLE");
    bytes32 public constant UPDATE_FEES_ROLE                           = keccak256("UPDATE_FEES_ROLE");
    bytes32 public constant UPDATE_COLLATERAL_TOKEN_ROLE               = keccak256("UPDATE_COLLATERAL_TOKEN_ROLE");
    bytes32 public constant UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE  = keccak256("UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE");
    bytes32 public constant UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE = keccak256("UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE");
    bytes32 public constant UPDATE_TAPPED_TOKEN_ROLE                   = keccak256("UPDATE_TAPPED_TOKEN_ROLE");
    bytes32 public constant TREASURY_TRANSFER_ROLE                     = keccak256("TREASURY_TRANSFER_ROLE");
    bytes32 public constant TRANSFER_ROLE                              = keccak256("TRANSFER_ROLE");
    bytes32 public constant VESTING_ROLE                               = keccak256("VESTING_ROLE");
    bytes32 public constant REVOKE_ROLE                                = keccak256("REVOKE_ROLE");
    bytes32 public constant RELEASE_ROLE                               = keccak256("RELEASE_ROLE");
    */
    bytes32 public constant MINTER_ROLE                                = 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6;
    bytes32 public constant BURNER_ROLE                                = 0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848;
    bytes32 public constant SUSPEND_ROLE                               = 0x091ece3b4e3685ed6d27f340286ac896d55b838dc58d4045d967a5d58f93d268;
    bytes32 public constant UPDATE_FEES_ROLE                           = 0x5f9be2932ed3a723f295a763be1804c7ebfd1a41c1348fb8bdf5be1c5cdca822;
    bytes32 public constant UPDATE_COLLATERAL_TOKEN_ROLE               = 0xe0565c2c43e0d841e206bb36a37f12f22584b4652ccee6f9e0c071b697a2e13d;
    bytes32 public constant UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE  = 0x5d94de7e429250eee4ff97e30ab9f383bea3cd564d6780e0a9e965b1add1d207;
    bytes32 public constant UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE = 0x57c9c67896cf0a4ffe92cbea66c2f7c34380af06bf14215dabb078cf8a6d99e1;
    bytes32 public constant UPDATE_TAPPED_TOKEN_ROLE                   = 0x83201394534c53ae0b4696fd49a933082d3e0525aa5a3d0a14a2f51e12213288;
    bytes32 public constant TREASURY_TRANSFER_ROLE                     = 0x694c459f7a04364da937ae77333217d0211063f4ed5560eeb8f79451399c153b;
    bytes32 public constant TRANSFER_ROLE                              = 0x8502233096d909befbda0999bb8ea2f3a6be3c138b9fbf003752a4c8bce86f6c;
    bytes32 public constant VESTING_ROLE                               = 0x6343452265350cc926492d9bfc7710ca06328d7c328cdb091fde925c1441e7a8;
    bytes32 public constant REVOKE_ROLE                                = 0x5297e68f3a27f04914f2c6db0ad63b5e5c8173cebcc1a5341df045cf6dad7adc;
    bytes32 public constant RELEASE_ROLE                               = 0x63f32341a2c9659e28e2f3da14b2d4dc3b076a5eebd426f016534536cda2948e;

    string private constant ERROR_INVALID_CONTRACT            = "ERROR_INVALID_CONTRACT";
    string private constant ERROR_INVALID_USER_ADDRESS        = "ERROR_INVALID_USER_ADDRESS";
    string private constant ERROR_EXTRA_SALE_UNNECESSARY      = "ERROR_SEEDSALE_AND_PRIVATESALE_WENT_WELL_NO_NEED_FOR_AN_EXTRA_SALE";
    string private constant ERROR_TAP_CANNOT_BE_REMOVED       = "ERROR_COLLATREAL_STILL_EXISTS_IN_MARKETMAKER_FIRST_REMOVE_MARKETMAKER_THEN_TAP";
    string private constant ERROR_COLLATERAL_CANNOT_BE_ADDED  = "ERROR_TAP_TOKEN_IS_NOT_TAPPED_TO_LET_MARKETMAKER_DO_ITS_JOB";
    string private constant ERROR_RELEASE_ACCESS_DENIED       = "ERROR_RELEASE_ACCESS_DENIED";
    string private constant ERROR_NOT_KYC                     = "ERROR_NOT_KYC";
    string private constant ERROR_CONTROLLER_MISMATCH         = "ERROR_CONTROLLER_MISMATCH";
    string private constant ERROR_SALE_MUST_BE_PENDING        = "ERROR_SALE_MUST_BE_PENDING";
    string private constant ERROR_VESTING_IS_CLOSED           = "ERROR_VESTING_IS_CLOSED";
    string private constant ERROR_SALE_DUPLICATION            = "ERROR_SALE_DUPLICATION";
    string private constant ERROR_COLLATERAL_NEEDED           = "ERROR_COLLATERAL_NEEDED";
    string private constant ERROR_WRONG_STATE                 = "ERROR_WRONG_STATE";
    string private constant ERROR_CONTRACT_DOES_NOT_EXIST     = "ERROR_CONTRACT_DOES_NOT_EXIST";
    string private constant ERROR_CONTRACT_ALREADY_EXISTS     = "ERROR_CONTRACT_ALREADY_EXISTS";
    string private constant ERROR_PROTOCOL_IS_LOCKED          = "ERROR_PROTOCOL_IS_LOCKED";

    event PreSaleChanged(address previousSale, address newSale);
    
    ControllerState   public state = ControllerState.Constructed;
    bool              public isProtocolLocked;
    
    address  public engaToken;
    address  public tokenManager;
    address  public marketMaker;
    address  public bancorFormula;
    address  public tap;
    address  public reserve;
    address  public treasury;
    address  public kyc;
    IPreSale public preSale;

    /**
    * @notice Constrcut Controller
    * @param _owner  the address of the multisig contract
    */
    constructor(address _owner) EngalandAccessControl(_owner) {
        _grantRole(keccak256("TEMP"), _msgSender());
    }

    function initContracts(
        address _engaToken,
        address _tokenManager,
        address _marketMaker,
        address _bancorFormula,
        address _tap,
        address _reserve,
        address _treasury,
        address _kyc
    )
        external
        onlyRole(keccak256("TEMP"))
    {
        require(state == ControllerState.Constructed);

        Utils.enforceHasContractCode(_engaToken, ERROR_INVALID_CONTRACT);
        Utils.enforceHasContractCode(_tokenManager, ERROR_INVALID_CONTRACT);
        Utils.enforceHasContractCode(_marketMaker, ERROR_INVALID_CONTRACT);
        Utils.enforceHasContractCode(_bancorFormula, ERROR_INVALID_CONTRACT);
        Utils.enforceHasContractCode(_tap, ERROR_INVALID_CONTRACT);
        Utils.enforceHasContractCode(_reserve, ERROR_INVALID_CONTRACT);
        Utils.enforceHasContractCode(_treasury, ERROR_INVALID_CONTRACT);
        Utils.enforceHasContractCode(_kyc, ERROR_INVALID_CONTRACT);

        engaToken = _engaToken;
        tokenManager = _tokenManager;
        marketMaker = _marketMaker;
        bancorFormula = _bancorFormula;
        tap = _tap;
        reserve = _reserve;
        treasury = _treasury;
        kyc = _kyc;

        EngalandBase(engaToken).grantRole(MINTER_ROLE, tokenManager);
        EngalandBase(engaToken).grantRole(BURNER_ROLE, tokenManager);

        EngalandBase(tokenManager).grantRole(MINTER_ROLE, marketMaker);
        EngalandBase(tokenManager).grantRole(BURNER_ROLE, marketMaker);

        EngalandBase(reserve).grantRole(TRANSFER_ROLE, marketMaker);
        EngalandBase(reserve).grantRole(TRANSFER_ROLE, tap);
        
        state = ControllerState.ContractsDeployed;
    }

    /* STATE MODIFIERS */

    /** INITIALIZERS **/

    /**
    * @notice Initialzie The Protocol
    * @param _stakeHolders                the address of the deployed stakeHolders
    * @param _seedSale                    the address of the deployed seedSale
    * @param _preSale                     the address of the deployed preSale
    * @param _batchBlocks                 the number of blocks batches are to last
    * @param _buyFeePct                   the fee to be deducted from buy orders [in PCT_BASE]
    * @param _sellFeePct                  the fee to be deducted from sell orders [in PCT_BASE
    * @param _maximumTapRateIncreasePct   the maximum tap rate increase percentage allowed [in PCT_BASE]
    * @param _maximumTapFloorDecreasePct  the maximum tap floor decrease percentage allowed [in PCT_BASE
    */
    function initializeProtocol(
        address _stakeHolders,
        address _seedSale,
        address _preSale,
        uint256 _batchBlocks,
        uint256 _buyFeePct,
        uint256 _sellFeePct,
        uint256 _maximumTapRateIncreasePct,
        uint256 _maximumTapFloorDecreasePct
    )
        external 
        onlyRole(keccak256("TEMP"))
    {
        require(state == ControllerState.ContractsDeployed);
        require(address(preSale) == address(0));
        
        Utils.enforceHasContractCode(_preSale, ERROR_INVALID_CONTRACT);
        require(IPreSale(_preSale).getController() == address(this), ERROR_CONTROLLER_MISMATCH);
        require(IPreSale(_preSale).state() == SaleState.Pending, ERROR_SALE_MUST_BE_PENDING);

        ITokenManager(tokenManager).initialize(_stakeHolders, _seedSale);
        IMarketMaker(marketMaker).initialize(_batchBlocks, _buyFeePct, _sellFeePct);
        ITap(tap).initialize(_batchBlocks, _maximumTapRateIncreasePct, _maximumTapFloorDecreasePct);

        _grantRole(VESTING_ROLE, _preSale);
        _grantRole(REVOKE_ROLE, _preSale);
        preSale = IPreSale(_preSale);

        _revokeRole(keccak256("TEMP"), _msgSender());
        state = ControllerState.Initialized;
    }

    /**
    * @notice Lock the hole protocol in emergency
    * @param _value a boolean indicating if the protocol is locked
    */
    function setProtocolState(bool _value) external onlyMultisig {
        require(state == ControllerState.Initialized);
        require(isProtocolLocked != _value);
        
        isProtocolLocked = _value;
    }

    /**
    * @notice Grant extra roles to an account if needed
    * @param _contract the address of the contract which is granting the role
    * @param _role     the role to be granted
    * @param _to       to whom(user or contract) the role is being granted
    */
    function grantRoleTo(address _contract, bytes32 _role, address _to) external onlyMultisig onlyOpenProtocol {
        require(EngalandBase(_contract).isInitialized());
        EngalandBase(_contract).grantRole(_role, _to);
    }

    /**
    * @notice Revoke extra roles from an account if needed
    * @param _contract the address of the contract which is revoking the role
    * @param _role     the role to be revoked
    * @param _from     from whom(user or contract) the role is being revoked
    */
    function revokeRoleFrom(address _contract, bytes32 _role, address _from) external onlyMultisig onlyOpenProtocol {
        require(EngalandBase(_contract).isInitialized());
        EngalandBase(_contract).revokeRole(_role, _from);
    }
    
    /**
    * @notice Activate another PreSale in case the previous one is failed, if the previous one is not failed, the new one will be ignored
    * @param _newSale the address of the new deployed sale
    */
    //NOTE we completely trust our PreSale, you should be careful if you're going to use another written PreSale other than ours, interface is crucial but implementation is much more important
    function setNewSaleAddress(address _newSale) external onlyMultisig onlyOpenProtocol { 
        Utils.enforceHasContractCode(_newSale, ERROR_INVALID_CONTRACT);
        require(IPreSale(_newSale).getController() == address(this), ERROR_CONTROLLER_MISMATCH);
        require(IPreSale(_newSale).state() == SaleState.Pending, ERROR_SALE_MUST_BE_PENDING);
        require(_newSale != address(preSale), ERROR_SALE_DUPLICATION);
        require(!ITokenManager(tokenManager).isVestingClosed(), ERROR_VESTING_IS_CLOSED);
        require(preSale.state() == SaleState.Refunding || preSale.state() == SaleState.Closed, ERROR_EXTRA_SALE_UNNECESSARY);

        address previousSale = address(preSale);

        if (hasRole(VESTING_ROLE, previousSale)) {
            _revokeRole(VESTING_ROLE, previousSale);
        }

        _grantRole(VESTING_ROLE, _newSale);
        _grantRole(REVOKE_ROLE, _newSale);
        preSale = IPreSale(_newSale);

        emit PreSaleChanged(previousSale, _newSale);
    }


    /************************************/
    /**** PRESALE SPECIFIC INTERFACE ****/
    /************************************/

    function closeSale() external onlyOpenProtocol {
        preSale.close();
    }

    function openSaleByDate(uint256 _openDate) external onlyMultisig onlyOpenProtocol {
        preSale.openByDate(_openDate);
    }

    function openSaleNow() external onlyMultisig onlyOpenProtocol {
        preSale.openNow();
    }

    function contribute(uint256 _value) external onlyOpenProtocol {
        require(IKycAuthorization(kyc).getKycOfUser(_msgSender()), ERROR_NOT_KYC);
        
        preSale.contribute(_msgSender(), _value);
    }

    function refund(address _contributor, bytes32 _vestedPurchaseId) external {
        preSale.refund(_contributor, _vestedPurchaseId);
    }
    
    /************************************/
    /**** PRESALE SPECIFIC INTERFACE ****/
    /************************************/




    /************************************/
    /****** KYC SPECIFIC INTERFACE ******/
    /************************************/
    
    function enableKyc() external onlyMultisig onlyOpenProtocol {
        IKycAuthorization(kyc).enableKyc();
    }
    
    function disableKyc() external onlyMultisig onlyOpenProtocol {
        IKycAuthorization(kyc).disableKyc();
    }

    function addKycUser(address _user) external onlyMultisig onlyOpenProtocol {
        IKycAuthorization(kyc).addKycUser(_user);
    }

    function removeKycUser(address _user) external onlyMultisig onlyOpenProtocol {
        IKycAuthorization(kyc).removeKycUser(_user);
    }

    function addKycUserBatch(address[] memory _users) external onlyMultisig onlyOpenProtocol {
        IKycAuthorization(kyc).addKycUserBatch(_users);
    }
    
    function removeKycUserBatch(address[] memory _users) external onlyMultisig onlyOpenProtocol {
        IKycAuthorization(kyc).removeKycUserBatch(_users);
    }
    
    function getKycOfUser(address _user) external view returns (bool) {
        return IKycAuthorization(kyc).getKycOfUser(_user);
    }

    /************************************/
    /****** KYC SPECIFIC INTERFACE ******/
    /************************************/



    /************************************/
    /*** Treasury SPECIFIC INTERFACE ****/
    /************************************/

    function treasuryTransfer(address _token, address _to, uint256 _value) external onlyMultisigOrRole(TREASURY_TRANSFER_ROLE) onlyOpenProtocol {
        IVaultERC20(treasury).transferERC20(_token, _to, _value);
    }

    /************************************/
    /*** Treasury SPECIFIC INTERFACE ****/
    /************************************/




    /************************************/
    /* TokenManager SPECIFIC INTERFACE **/
    /************************************/
    
    function createVesting(address _beneficiary, uint256 _amount, uint256 _start, uint256 _cliff, uint256 _end, bool _revocable)
        external
        onlyRole(VESTING_ROLE)
        onlyOpenProtocol
        returns (bytes32)
    {
        address vestingCreator = _msgSender();
        return ITokenManager(tokenManager).createVesting(_beneficiary, vestingCreator, _amount, _start, _cliff, _end, _revocable);
    }
    
    function revoke(bytes32 vestingId) external onlyRole(REVOKE_ROLE) onlyOpenProtocol {
        ITokenManager(tokenManager).revoke(vestingId);
    }

    function release(bytes32 vestingId) external onlyOpenProtocol {
        bool isMultisig = _msgSender() == owner;
        bool isBeneficiary = _msgSender() == ITokenManager(tokenManager).getVestingOwner(vestingId);
        bool hasReleaseRole = hasRole(RELEASE_ROLE, _msgSender());
        
        require(isBeneficiary || hasReleaseRole || isMultisig, ERROR_RELEASE_ACCESS_DENIED);
        ITokenManager(tokenManager).release(vestingId);
    }

    /**
    * @notice for the time that vesting is a payment splitter that is created in token manager's constructor
    * @param vestingId  the id of the vesting created in token manager
    */
    function releaseVaultOfBeneficiary(bytes32 vestingId) external onlyOpenProtocol {
        bool isMultisig = _msgSender() == owner;
        bool hasReleaseRole = hasRole(RELEASE_ROLE, _msgSender());
        address vault = ITokenManager(tokenManager).getVestingOwner(vestingId);
        require(vault != _msgSender());
        
        bool isMemberOfVault = IPaymentSplitter(vault).shares(_msgSender()) > 0;
        require(isMemberOfVault || hasReleaseRole || isMultisig, ERROR_RELEASE_ACCESS_DENIED);

        ITokenManager(tokenManager).release(vestingId);
    }
    
    function closeVestingProcess() external onlyMultisig onlyOpenProtocol {
        ITokenManager(tokenManager).closeVestingProcess();
    }

    function withdrawTokenManger(address _token, address _receiver, uint256 _amount) external onlyMultisig onlyOpenProtocol {
        ITokenManager(tokenManager).withdraw(_token, _receiver, _amount);
    }

    /************************************/
    /* TokenManager SPECIFIC INTERFACE **/
    /************************************/




    /************************************/
    /** MarketMaker SPECIFIC INTERFACE **/
    /************************************/
    
    function collateralsToBeClaimed(address _collateral) external view returns(uint256) {
        return IMarketMaker(marketMaker).collateralsToBeClaimed(_collateral);
    }

    function openPublicTrading(address[] memory _collaterals) external onlyMultisig onlyOpenProtocol {
        if (preSale.state() != SaleState.Closed) {
            preSale.close(); // reverts if conditions aren't met
        }
        
        if (!ITokenManager(tokenManager).isVestingClosed()) {
            ITokenManager(tokenManager).closeVestingProcess();
        }

        for (uint256 i = 0; i < _collaterals.length; i++) {
            require(IMarketMaker(marketMaker).collateralIsWhitelisted(_collaterals[i]));
            ITap(tap).resetTappedToken(_collaterals[i]);
        }

        IMarketMaker(marketMaker).open();
    }

    function suspendMarketMaker(bool _value) external onlyMultisigOrRole(SUSPEND_ROLE) onlyOpenProtocol {
        IMarketMaker(marketMaker).suspend(_value);
    }

    function updateBancorFormula(address _bancor) external onlyMultisig onlyOpenProtocol {
        IMarketMaker(marketMaker).updateBancorFormula(_bancor);
        bancorFormula = _bancor;
    }

    function updateTreasury(address payable _treasury) external onlyMultisig onlyOpenProtocol {
        IMarketMaker(marketMaker).updateTreasury(_treasury);
        treasury = _treasury;
    }

    function updateFees(uint256 _buyFeePct, uint256 _sellFeePct) external onlyMultisigOrRole(UPDATE_FEES_ROLE) onlyOpenProtocol {
        IMarketMaker(marketMaker).updateFees(_buyFeePct, _sellFeePct);
    }

    function addCollateralToken(
        address _collateral,
        uint256 _virtualSupply,
        uint256 _virtualBalance,
        uint32  _reserveRatio,
        uint256 _slippage,
        uint256 _rate,
        uint256 _floor
    )
        external
        onlyMultisig
        onlyOpenProtocol
    {
        IMarketMaker(marketMaker).addCollateralToken(_collateral, _virtualSupply, _virtualBalance, _reserveRatio, _slippage);
        
        if (_rate > 0) {
            ITap(tap).addTappedToken(_collateral, _rate, _floor);
        }
    }

    function reAddCollateralToken(
        address _collateral,
        uint256 _virtualSupply,
        uint256 _virtualBalance,
        uint32  _reserveRatio,
        uint256 _slippage
    )
    	external
        onlyMultisig
        onlyOpenProtocol
    {
        require(ITap(tap).tokenIsTapped(_collateral), ERROR_COLLATERAL_CANNOT_BE_ADDED);
        IMarketMaker(marketMaker).addCollateralToken(_collateral, _virtualSupply, _virtualBalance, _reserveRatio, _slippage);
    }

    function removeCollateralToken(address _collateral) external onlyMultisig onlyOpenProtocol {
        IMarketMaker(marketMaker).removeCollateralToken(_collateral);
    }
    
    function updateCollateralToken(
        address _collateral,
        uint256 _virtualSupply,
        uint256 _virtualBalance,
        uint32 _reserveRatio,
        uint256 _slippage
    )
        external
        onlyMultisigOrRole(UPDATE_COLLATERAL_TOKEN_ROLE)
        onlyOpenProtocol
    {
        IMarketMaker(marketMaker).updateCollateralToken(_collateral, _virtualSupply, _virtualBalance, _reserveRatio, _slippage);
    }
    
    function openBuyOrder(address _collateral, uint256 _value) external onlyOpenProtocol {
        require(IKycAuthorization(kyc).getKycOfUser(_msgSender()), ERROR_NOT_KYC);
        IMarketMaker(marketMaker).openBuyOrder(_msgSender(), _collateral, _value);
    }

    function openSellOrder(address _collateral, uint256 _amount) external onlyOpenProtocol {
        require(IKycAuthorization(kyc).getKycOfUser(_msgSender()), ERROR_NOT_KYC);
        IMarketMaker(marketMaker).openSellOrder(_msgSender(), _collateral, _amount);
    }
    
    function claimBuyOrder(address _buyer, uint256 _batchId, address _collateral) external onlyOpenProtocol {
        IMarketMaker(marketMaker).claimBuyOrder(_buyer, _batchId, _collateral);
    }
    
    function claimSellOrder(address _seller, uint256 _batchId, address _collateral) external onlyOpenProtocol {
        IMarketMaker(marketMaker).claimSellOrder(_seller, _batchId, _collateral);
    }

    function claimCancelledBuyOrder(address _buyer, uint256 _batchId, address _collateral) external onlyOpenProtocol {
        IMarketMaker(marketMaker).claimCancelledBuyOrder(_buyer, _batchId, _collateral);
    }

    function claimCancelledSellOrder(address _seller, uint256 _batchId, address _collateral) external onlyOpenProtocol {
        IMarketMaker(marketMaker).claimCancelledSellOrder(_seller, _batchId, _collateral);
    }
    /************************************/
    /** MarketMaker SPECIFIC INTERFACE **/
    /************************************/




    /************************************/
    /****** TAP SPECIFIC INTERFACE ******/
    /************************************/
    
    function updateBeneficiary(address payable _beneficiary) external onlyMultisig onlyOpenProtocol {
        ITap(tap).updateBeneficiary(_beneficiary);
    }
    
    function updateMaximumTapRateIncreasePct(uint256 _maximumTapRateIncreasePct) external onlyMultisigOrRole(UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE) onlyOpenProtocol {
        ITap(tap).updateMaximumTapRateIncreasePct(_maximumTapRateIncreasePct);
    }
    
    function updateMaximumTapFloorDecreasePct(uint256 _maximumTapFloorDecreasePct) external onlyMultisigOrRole(UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE) onlyOpenProtocol {
        ITap(tap).updateMaximumTapFloorDecreasePct(_maximumTapFloorDecreasePct);
    }
    
    function removeTappedToken(address _token) external onlyMultisig onlyOpenProtocol {
        require(!IMarketMaker(marketMaker).collateralIsWhitelisted(_token), ERROR_TAP_CANNOT_BE_REMOVED);
        ITap(tap).removeTappedToken(_token);
    }
    
    function updateTappedToken(address _token, uint256 _rate, uint256 _floor) external onlyMultisigOrRole(UPDATE_TAPPED_TOKEN_ROLE) onlyOpenProtocol {
        ITap(tap).updateTappedToken(_token, _rate, _floor);
    }
    
    function updateTappedAmount(address _token) external onlyOpenProtocol {
        ITap(tap).updateTappedAmount(_token);
    }
    
    function withdrawTap(address _collateral) external onlyMultisig onlyOpenProtocol {
        ITap(tap).withdraw(_collateral);
    }
    
    function getMaximumWithdrawal(address _token) external view returns (uint256) {
        return ITap(tap).getMaximumWithdrawal(_token);
    }
    /************************************/
    /****** TAP SPECIFIC INTERFACE ******/
    /************************************/

    /* VIEW */
    function beneficiary() external view returns(address) {
        return owner;
    }

    /* MODIFIERS */
    modifier onlyOpenProtocol {
        require(state == ControllerState.Initialized);
        require(!isProtocolLocked, ERROR_PROTOCOL_IS_LOCKED);
        _;
    }
}