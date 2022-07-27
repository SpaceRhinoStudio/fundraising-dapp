/**
* ENGA Federation Pre-Sale.
* @author Mehdikovic
* Date created: 2022.03.06
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

import { IPreSale, SaleState } from "../interfaces/fundraising/IPreSale.sol";
import { IController } from "../interfaces/fundraising/IController.sol";
import { TimeHelper } from "../common/TimeHelper.sol";
import { Utils } from "../lib/Utils.sol";


contract PreSale is IPreSale, AccessControl, TimeHelper, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint32 public constant PPM = 1000000; // 0% = 0 * 10 ** 4; 1% = 1 * 10 ** 4; 100% = 100 * 10 ** 4

    string private constant ERROR_INVALID_STATE                  = "ERROR_INVALID_STATE";
    string private constant ERROR_INVALID_CONTRACT               = "ERROR_INVALID_CONTRACT";
    string private constant ERROR_INVALID_TIME_PERIOD            = "ERROR_INVALID_TIME_PERIOD";
    string private constant ERROR_INVALID_GOAL                   = "ERROR_INVALID_GOAL";
    string private constant ERROR_INVALID_EXCHANGE_RATE          = "ERROR_INVALID_EXCHANGE_RATE";
    string private constant ERROR_INVALID_PCT                    = "ERROR_INVALID_PCT";
    string private constant ERROR_INVALID_MINIMUM_REQUIRED_TOKEN = "ERROR_INVALID_MINIMUM_REQUIRED_TOKEN";
    string private constant ERROR_DATE_HAS_BEEN_SET_BEFORE       = "ERROR_DATE_HAS_BEEN_SET_BEFORE";
    string private constant ERROR_INVALID_CONTRIBUTE_VALUE       = "ERROR_INVALID_CONTRIBUTE_VALUE";
    string private constant THERE_IS_NO_CONTRIBUTION_FOR_USER    = "THERE_IS_NO_CONTRIBUTION_FOR_USER";

    IController public controller;
    address public reserve;
    address public beneficiary;
    address public contributionToken;
    uint256 public fundingForBeneficiaryPct;

    uint256 public goal;
    uint256 public period;
    uint256 public exchangeRate;
    uint256 public vestingCliffPeriod;
    uint256 public vestingCompletePeriod;

    uint256 public minimumRequiredToken;

    bool public isClosed;
    uint256 public openDate;
    uint256 public totalRaised;
    
    mapping(address => mapping(bytes32 => uint256)) public contributions; // contributor => (vestedPurchaseId => tokensSpent)

    event SetOpenDate(uint256 date);
    event Close();
    event Contribute(address indexed contributor, uint256 value, uint256 amount, bytes32 vestedPurchaseId);
    event Refund(address indexed contributor, uint256 value, bytes32 vestedPurchaseId);

    /***** EXTERNAL *****/

    /**
    * @notice Initialize presale
    * @param _controller               The address of controller contract
    * @param _contributionToken        The address of the token to be used to contribute
    * @param _goal                     The goal to be reached by the end of that presale [in contribution token wei]
    * @param _period                   The period within which to accept contribution for that presale
    * @param _exchangeRate             The exchangeRate [= 1/price] at which [bonded] tokens are to be purchased for that presale [in PPM]
    * @param _vestingCliffPeriod       The period during which purchased [bonded] tokens are to be cliffed
    * @param _vestingCompletePeriod    The complete period during which purchased [bonded] tokens are to be vested
    * @param _fundingForBeneficiaryPct The percentage of the raised contribution tokens to be sent to the beneficiary [instead of the fundraising reserve] when that presale is closed [in PPM]
    * @param _minimumRequiredToken     The minimum amount required to let users contribute in sell
    */
    constructor (
        address _controller,
        address _contributionToken,
        uint256 _goal,
        uint256 _period,
        uint256 _exchangeRate,
        uint256 _vestingCliffPeriod,
        uint256 _vestingCompletePeriod,
        uint256 _fundingForBeneficiaryPct,
        uint256 _minimumRequiredToken
    ) {
        Utils.enforceHasContractCode(_controller, ERROR_INVALID_CONTRACT);
        Utils.enforceHasContractCode(_contributionToken, ERROR_INVALID_CONTRACT);
        require(_goal > 0, ERROR_INVALID_GOAL);
        require(_period > 0, ERROR_INVALID_TIME_PERIOD);
        require(_exchangeRate > 0, ERROR_INVALID_EXCHANGE_RATE);
        require(_vestingCliffPeriod > _period, ERROR_INVALID_TIME_PERIOD);
        require(_vestingCompletePeriod > _vestingCliffPeriod, ERROR_INVALID_TIME_PERIOD);
        require(_fundingForBeneficiaryPct >= 0 && _fundingForBeneficiaryPct <= PPM, ERROR_INVALID_PCT);
        require(_minimumRequiredToken != 0, ERROR_INVALID_MINIMUM_REQUIRED_TOKEN);

        controller = IController(_controller);
        require(controller.state() != IController.ControllerState.Constructed, ERROR_INVALID_STATE);

        beneficiary =  controller.beneficiary();
        reserve = controller.reserve();
        contributionToken = _contributionToken;
        goal = _goal;
        period = _period;
        exchangeRate = _exchangeRate;
        vestingCliffPeriod = _vestingCliffPeriod;
        vestingCompletePeriod = _vestingCompletePeriod;
        fundingForBeneficiaryPct = _fundingForBeneficiaryPct;
        minimumRequiredToken = _minimumRequiredToken;

        _grantRole(DEFAULT_ADMIN_ROLE, _controller);
    }

    /* STATE MODIFIERS */

    /**
    * @notice Open presale [enabling users to contribute]
    * @param _openDate The date at which the presale will be opened
    */
    function openByDate(uint256 _openDate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(state() == SaleState.Pending, ERROR_INVALID_STATE);
        require(openDate == 0, ERROR_DATE_HAS_BEEN_SET_BEFORE);
        require(_openDate >= getTimeNow(), ERROR_INVALID_TIME_PERIOD);
        
        _setOpenDate(_openDate);
    }

    /**
    * @notice Open presale [enabling users to contribute]
    */
    function openNow() external onlyRole(DEFAULT_ADMIN_ROLE) {
       require(state() == SaleState.Pending, ERROR_INVALID_STATE);
       require(openDate == 0, ERROR_DATE_HAS_BEEN_SET_BEFORE);
        
        _setOpenDate(getTimeNow());
    }

    /**
    * @notice Contribute to the presale up to `@tokenAmount(self.contributionToken(): address, _value)`
    * @param _contributor the address of the contributor passed by controller
    * @param _value       the amount of contribution token to be spent
    */
    function contribute(address _contributor, uint256 _value) external nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
        require(state() == SaleState.Funding, ERROR_INVALID_STATE);
        require(_value >= minimumRequiredToken, ERROR_INVALID_CONTRIBUTE_VALUE);

        _contribute(_contributor, _value);
    }

    /**
    * @notice Refund `_contributor`'s presale contribution #`_vestedPurchaseId`
    * @param _contributor      the address of the contributor whose presale contribution is to be refunded
    * @param _vestedPurchaseId the id of the contribution to be refunded
    */
    function refund(address _contributor, bytes32 _vestedPurchaseId) external nonReentrant {
        require(state() == SaleState.Refunding, ERROR_INVALID_STATE);
        require(contributions[_contributor][_vestedPurchaseId] > 0, THERE_IS_NO_CONTRIBUTION_FOR_USER);

        _refund(_contributor, _vestedPurchaseId);
    }

    /**
    * @notice Close presale and open trading
    */
    function close() external nonReentrant {
        require(state() == SaleState.GoalReached, ERROR_INVALID_STATE);

        _close();
    }

    /* PUBLIC VIEWS */

    /**
    * @notice Computes the amount of [bonded] tokens that would be purchased for `@tokenAmount(self.contributionToken(): address, _value)`
    * @param _contribution The amount of contribution tokens to be used in that computation
    */
    function contributionToTokens(uint256 _contribution) public view returns (uint256) {
        return (_contribution * exchangeRate) / PPM;
    }

    /**
    * @notice Computes the amount of `@tokenAmount(self.contributionToken(): address, _value)` that had been paid for `@tokenAmount(self.contributionToken(): address, _value)
    * @param _engaToken The amount of enga tokens that are bought by contribution
    */
    function tokenToContributions(uint256 _engaToken) public view returns (uint256) {
        return (_engaToken * PPM) / exchangeRate;
    }

    /**
    * @notice returns the address of the controller
    */
    function getController() external view returns(address) {
        return address(controller);
    }

    /**
    * @notice Returns the current state of that presale
    */
    function state() public virtual view returns (SaleState) {
        if (openDate == 0 || openDate > getTimeNow()) {
            return SaleState.Pending;
        }

        if (totalRaised >= goal) {
            if (isClosed) {
                return SaleState.Closed;
            } else {
                return SaleState.GoalReached;
            }
        }

        if (_timeSinceOpen() < period) {
            return SaleState.Funding;
        } else {
            return SaleState.Refunding;
        }
    }

    /***** INTERNAL *****/

    function _timeSinceOpen() internal view returns (uint256) {
        return getTimeNow() - openDate;
    }

    function _setOpenDate(uint256 _date) internal {
        openDate = _date;
        emit SetOpenDate(_date);
    }

    function _contribute(address _contributor, uint256 _value) internal {
        uint256 value = totalRaised + _value > goal ? goal - totalRaised : _value;

        require(IERC20(contributionToken).balanceOf(_contributor) >= value, "ERROR_INSUFFICIENT_BALANCE");
        require(IERC20(contributionToken).allowance(_contributor, address(this)) >= value, "ERROR_INSUFFICIENT_ALLOWANCE");
        _transfer(contributionToken, _contributor, address(this), value);
        
        uint256 tokensToSell = contributionToTokens(value);
        bytes32 vestedPurchaseId = controller.createVesting(
            _contributor,
            tokensToSell,
            getTimeNow(),
            getTimeNow() + vestingCliffPeriod, 
            getTimeNow() + vestingCompletePeriod,
            true /* REVOKABLE */
        );
        
        totalRaised = totalRaised + value;
        contributions[_contributor][vestedPurchaseId] = value;

        emit Contribute(_contributor, value, tokensToSell, vestedPurchaseId);
    }

    function _refund(address _contributor, bytes32 _vestedPurchaseId) internal {
        uint256 contributionTokensToRefund = contributions[_contributor][_vestedPurchaseId];
        contributions[_contributor][_vestedPurchaseId] = 0;
        
        // NOTE burning is called and all of the minted token will be burned
        controller.revoke(_vestedPurchaseId);
        
        _transfer(contributionToken, address(this), _contributor, contributionTokensToRefund);
        
        emit Refund(_contributor, contributionTokensToRefund, _vestedPurchaseId);
    }

    function _close() internal {
        isClosed = true;

        uint256 fundsForBeneficiary = (totalRaised * fundingForBeneficiaryPct) / PPM;
        if (fundsForBeneficiary > 0) {
            _transfer(contributionToken, address(this), beneficiary, fundsForBeneficiary);
        }
        
        uint256 tokensForReserve = IERC20(contributionToken).balanceOf(address(this));
        if (tokensForReserve > 0) {
            _transfer(contributionToken, address(this), reserve, tokensForReserve);
        }

        emit Close();
    }

    function _transfer(address _token, address _from, address _to, uint256 _amount) internal {
        if (_from == address(this)) {
            IERC20(_token).safeTransfer(_to, _amount);
        } else {
            IERC20(_token).safeTransferFrom(_from, _to, _amount);
        }
    }
}