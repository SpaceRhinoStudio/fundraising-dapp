/**
* ENGA Federation Initial-Sale.
* @author Mehdikovic
* Date created: 2022.06.03
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

import { SaleState } from "../interfaces/fundraising/IPreSale.sol";
import { TimeHelper } from "../common/TimeHelper.sol";
import { Utils } from "../lib/Utils.sol";


contract SeedSale is TimeHelper, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /**
    bytes32 public constant OPEN_ROLE         = keccak256("OPEN_ROLE");
    */
    bytes32 public constant OPEN_ROLE         = 0xefa06053e2ca99a43c97c4a4f3d8a394ee3323a8ff237e625fba09fe30ceb0a4;

    uint32 public constant PPM = 1000000;
    
    string private constant ERROR_CONTRACT_IS_ZERO               = "ERROR_CONTRACT_IS_ZERO";
    string private constant ERROR_INVALID_CONTRACT               = "ERROR_INVALID_CONTRACT";
    string private constant ERROR_INVALID_INDEX                  = "ERROR_INVALID_INDEX";
    string private constant ERROR_INVALID_TIME_PERIOD            = "ERROR_INVALID_TIME_PERIOD";
    string private constant ERROR_INVALID_GOAL                   = "ERROR_INVALID_GOAL";
    string private constant ERROR_INVALID_MINIMUM_REQUIRED_TOKEN = "ERROR_INVALID_MINIMUM_REQUIRED_TOKEN";
    string private constant ERROR_INVALID_CONTRIBUTE_VALUE       = "ERROR_INVALID_CONTRIBUTE_VALUE";
    string private constant ERROR_INVALID_AMOUNT                 = "ERROR_INVALID_AMOUNT";
    string private constant ERROR_INSUFFICIENT_BALANCE           = "ERROR_INSUFFICIENT_BALANCE";
    string private constant ERROR_INSUFFICIENT_ALLOWANCE         = "ERROR_INSUFFICIENT_ALLOWANCE";
    string private constant ERROR_NO_VESTING_FOUND               = "ERROR_NO_VESTING_FOUND";

    struct Vesting {
        bool initialized;
        
        address beneficiary; // beneficiary of tokens after they are released
        uint256 amountTotal; // total amount of tokens to be released at the end of the vesting
        uint256 released; // amount of tokens released
        
        uint256 start; // start time of the vesting period
        uint256 cliff; // cliff (start time is added before) in seconds
        uint256 end; // end (start time is added before) of the vesting in seconds
    }

    address public contributionToken;
    address public engaToken;
    address public spaceRhinoBeneficiary;

    uint256 public daiGoal;
    uint256 public engaGoal;
    uint256 public vestingCliffPeriod;
    uint256 public vestingCompletePeriod;

    uint256 public minimumRequiredToken;

    bool public isOpen;
    uint256 public totalRaised;

    bytes32[] internal vestingsIds;
    mapping(bytes32 => Vesting) internal vestings;
    mapping(address => uint256) internal vestingsCount;
    
    event SaleOpened();
    event VestingCreated(address indexed beneficiary, bytes32 id, uint256 amount);
    event VestingReleased(address indexed beneficiary, bytes32 id, uint256 amount);

    /***** EXTERNAL *****/

    /**
    * @notice Initialize presale
    * @param _owner                     The address of the multisig contract as the owner
    * @param _daiGoal                  The daiGoal to be reached by the end of that presale [in contribution token wei]
    * @param _engaGoal                 The engaGoal to be reached by the end of that presale [in contribution token wei]
    * @param _vestingCliffPeriod       The period during which purchased [bonded] tokens are to be cliffed
    * @param _vestingCompletePeriod    The complete period during which purchased [bonded] tokens are to be vested
    * @param _minimumRequiredToken     The minimum amount required to let users contribute in sell
    */
    constructor(
        address _owner,
        uint256 _daiGoal,
        uint256 _engaGoal,
        uint256 _vestingCliffPeriod,
        uint256 _vestingCompletePeriod,
        uint256 _minimumRequiredToken
    ) {
        Utils.enforceHasContractCode(_owner, ERROR_INVALID_CONTRACT);
        
        require(_daiGoal > 0, ERROR_INVALID_GOAL);
        require(_engaGoal > 0, ERROR_INVALID_GOAL);
        require(_vestingCliffPeriod >= 1 days, ERROR_INVALID_TIME_PERIOD);
        require(_vestingCompletePeriod > _vestingCliffPeriod, ERROR_INVALID_TIME_PERIOD);
        require(_minimumRequiredToken != 0, ERROR_INVALID_MINIMUM_REQUIRED_TOKEN);

        daiGoal = _daiGoal;
        engaGoal = _engaGoal;
        spaceRhinoBeneficiary = _owner;
        vestingCliffPeriod = _vestingCliffPeriod;
        vestingCompletePeriod = _vestingCompletePeriod;
        minimumRequiredToken = _minimumRequiredToken;

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(OPEN_ROLE, _owner);
        _grantRole(OPEN_ROLE, _msgSender());
    }

    /* STATE MODIFIERS */

    /**
    * @notice set initilizing addresses of other contracts
    * @param _contributionToken         The address of the contributionToken contract (dai)
    * @param _engaToken                 The address of the engaToken contract
    */
    function initializeAddresses(address _contributionToken, address _engaToken) external onlyRole(OPEN_ROLE) {
        Utils.enforceHasContractCode(_contributionToken, ERROR_INVALID_CONTRACT);
        Utils.enforceHasContractCode(_engaToken, ERROR_INVALID_CONTRACT);
        require(isOpen == false);
        
        contributionToken = _contributionToken;
        engaToken = _engaToken;
    }

    /**
    * @notice Open presale [enabling users to contribute]
    */
    function openNow() external onlyRole(OPEN_ROLE) {
        require(isOpen == false);
        Utils.enforceValidAddress(contributionToken, ERROR_CONTRACT_IS_ZERO);
        Utils.enforceValidAddress(engaToken, ERROR_CONTRACT_IS_ZERO);
        require(IERC20(engaToken).balanceOf(address(this)) >= engaGoal, ERROR_INSUFFICIENT_BALANCE);
        
        isOpen = true;
        emit SaleOpened();
    }

    /**
    * @notice Contribute to the presale up to `@tokenAmount(self.contributionToken(): address, _value)`
    * @param _value       The amount of contribution token to be spent
    */
    function contribute(uint256 _value) external nonReentrant onlyOpen {
        require(_value >= minimumRequiredToken, ERROR_INVALID_CONTRIBUTE_VALUE);
        require(totalRaised < daiGoal);

        _contribute(_msgSender(), _value);
    }

    /**
    * @notice let users release their tokens in their vesting
    * @param vestingId           The id of the vesting
    */
    function release(bytes32 vestingId)
        external
        onlyVestingExists(vestingId)
        nonReentrant
        onlyOpen
    {
        Vesting storage vesting = vestings[vestingId];
        
        uint256 amount = _releaseVesting(vesting);

        require(amount > 0, ERROR_INVALID_AMOUNT);

        IERC20(engaToken).safeTransfer(vesting.beneficiary, amount);
        
        emit VestingReleased(vesting.beneficiary, vestingId, amount);
    }

    /* PUBLIC VIEWS */

    /**
    * @dev indicates what state the presale is in
    * @return the status of the sale [Pending, Funding, Closed]
    */
    function state() public view returns (SaleState) {
        if (!isOpen)
            return SaleState.Pending;
        if (totalRaised >= daiGoal)
            return SaleState.Closed;
        return SaleState.Funding;
    }

    /**
    * @dev Returns the number of vesting associated to a beneficiary.
    * @return the number of vesting
    */
    function getHolderVestingCount(address _beneficiary) external view returns(uint256) {
        return vestingsCount[_beneficiary];
    }

    /**
    * @dev Returns the vesting id at the given index.
    * @return the vesting id
    */
    function getVestingIdAtIndex(uint256 index) external view returns(bytes32) {
        require(index < getVestingCount(), ERROR_INVALID_INDEX);
        return vestingsIds[index];
    }

    /**
    * @notice Returns the vesting information for a given holder and index.
    * @return the vesting  structure information
    */
    function getVestingByAddressAndIndex(address holder, uint256 index) external view returns(Vesting memory) {
        return getVesting(computeId(holder, index));
    }

    /**
    * @dev Returns the number of vesting  managed by this contract.
    * @return the number of vesting 
    */
    function getVestingCount() public view returns(uint256) {
        return vestingsIds.length;
    }

    /**
    * @notice Computes the amount of [bonded] tokens that would be purchased for `@tokenAmount(self.contributionToken(): address, _value)`
    * @param _contribution The amount of contribution tokens to be used in that computation
    */
    function contributionToTokens(uint256 _contribution) public view returns (uint256) {
        return (_contribution * _exchangeRatePPM()) / PPM;
    }

    /**
    * @notice Computes the amount of `@tokenAmount(self.contributionToken(): address, _value)` that had been paid for `@tokenAmount(self.contributionToken(): address, _value)
    * @param _engaToken The amount of enga tokens that are bought by contribution
    */
    function tokenToContributions(uint256 _engaToken) public view returns (uint256) {
        return (_engaToken * PPM) / _exchangeRatePPM();
    }

    function getExchangeRate() external view returns(uint256) {
        return _exchangeRatePPM();
    }

    function computeNextId(address holder) public view returns(bytes32) {
        return computeId(holder, vestingsCount[holder]);
    }

    function computeId(address holder, uint256 index) public pure returns(bytes32) {
        return keccak256(abi.encodePacked(holder, index));
    }

    /**
    * @dev Returns the last vesting for a given holder address.
    */
    function getLastVestingForHolder(address holder) public view returns(Vesting memory) {
        require(vestingsCount[holder] > 0, ERROR_NO_VESTING_FOUND);
        return vestings[computeId(holder, vestingsCount[holder] - 1)];
    }

    /**
    * @notice Returns the vesting  information for a given identifier.
    * @return the vesting  structure information
    */
    function getVesting(bytes32 vestingId) public view returns(Vesting memory) {
        return vestings[vestingId];
    }

    /**
    * @notice Returns the owner of the vesting
    * @return the address of beneficiary
    */
    function getVestingOwner(bytes32 vestingId) external view returns(address) {
        return vestings[vestingId].beneficiary;
    }

    /* MODIFIERS */
    modifier onlyVestingExists(bytes32 vestingId) {
        require(vestings[vestingId].initialized == true);
        _;
    }

    modifier onlyOpen() {
        require(isOpen == true);
        _;
    }

    /***** INTERNAL *****/

    function _contribute(address _contributor, uint256 _value) internal {
        uint256 value = totalRaised + _value > daiGoal ? daiGoal - totalRaised : _value;

        require(IERC20(contributionToken).balanceOf(_contributor) >= value, ERROR_INSUFFICIENT_BALANCE);
        require(IERC20(contributionToken).allowance(_contributor, address(this)) >= value, ERROR_INSUFFICIENT_ALLOWANCE);
        _transfer(contributionToken, _contributor, spaceRhinoBeneficiary, value);
        
        uint256 tokensToSell = contributionToTokens(value);

        bytes32 vestingId = computeNextId(_contributor);
        vestings[vestingId] = Vesting(
            true,
            _contributor,
            tokensToSell,
            0,
            getTimeNow(),
            getTimeNow() + vestingCliffPeriod, 
            getTimeNow() + vestingCompletePeriod
        );

        totalRaised += value;
        vestingsIds.push(vestingId);
        vestingsCount[_contributor]++;
        
        emit VestingCreated(_contributor, vestingId, tokensToSell);
    }

    function _releaseVesting(Vesting storage vesting) internal returns(uint256 amount) {
        amount = _computeReleasableAmount(vesting);
        
        if (amount == 0) return 0;
        
        vesting.released += amount;
    }

    function _computeReleasableAmount(Vesting storage vesting)
        internal
        view
        returns(uint256)
    {
        uint256 currentTime = getTimeNow();
        if (currentTime < vesting.cliff) {
            return 0;
        } else if (currentTime >= vesting.end) {
            return vesting.amountTotal - vesting.released;
        } else {
            uint256 start = vesting.cliff; // start from cliff date
            uint256 duration = vesting.end - vesting.cliff; // duration between cliff and end time
            uint256 pastTime = currentTime - start; // how much time has passed from cliff until now
            uint256 vestedAmount = (vesting.amountTotal * pastTime) / duration;
            return vestedAmount - vesting.released;
        }
    }

    function _exchangeRatePPM() internal view returns(uint256) {
        return engaGoal * PPM / daiGoal;
    }

    function _transfer(address _token, address _from, address _to, uint256 _amount) internal {
        if (_from == address(this)) {
            IERC20(_token).safeTransfer(_to, _amount);
        } else {
            IERC20(_token).safeTransferFrom(_from, _to, _amount);
        }
    }
}