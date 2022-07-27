/**
* ENGA Federation Token Manager.
* @author Mehdikovic
* Date created: 2022.03.03
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import { IEngaToken } from "../interfaces/fundraising/IEngaToken.sol";
import { IController } from "../interfaces/fundraising/IController.sol";
import { ITokenManager } from "../interfaces/fundraising/ITokenManager.sol";
import { IPreSale, SaleState } from "../interfaces/fundraising/IPreSale.sol";
import { EngalandBase } from "../common/EngalandBase.sol";
import { TimeHelper } from "../common/TimeHelper.sol";
import { Utils } from "../lib/Utils.sol";


contract TokenManager is ITokenManager, EngalandBase ,ReentrancyGuard, TimeHelper {
    using SafeERC20 for IERC20;
    
    /**
    bytes32 public constant MINTER_ROLE                = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE                = keccak256("BURNER_ROLE");
    */
    bytes32 public constant MINTER_ROLE                = 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6;
    bytes32 public constant BURNER_ROLE                = 0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848;

    uint256 private constant MAX_VEST_PER_USER = 50;
    uint256 private constant MONTH = 30 days;
    uint256 private constant YEAR = 365 days;
    
    struct Vesting {
        bool initialized;
        
        address beneficiary; // beneficiary of tokens after they are released
        address vestingCreator; // pre-sale creator of the vesting for checking states of it
        uint256 amountTotal; // total amount of tokens to be released at the end of the vesting
        uint256 released; // amount of tokens released
        
        uint256 start; // start time of the vesting period
        uint256 cliff; // cliff (start time is added before) in seconds
        uint256 end; // end (start time is added before) of the vesting in seconds

        bool revocable; // whether or not the vesting is revocable
        bool revoked; // whether or not the vesting has been revoked
    }

    event VestingCreated(address indexed beneficiary, bytes32 id, uint256 amount);
    event VestingReleased(address indexed beneficiary, bytes32 id, uint256 amount);
    event VestingRevoked(address indexed beneficiary, bytes32 id, uint256 revokedAmount);
    event Withdrawn(address indexed receiver, uint256 amount);

    uint256 public vestingsTotalAmount;
    bytes32[] internal vestingsIds;
    mapping(bytes32 => Vesting) internal vestings;
    mapping(address => uint256) internal vestingsCount;
    
    bool public vestingLockedForEver = false;
    IEngaToken public engaToken;

    //solhint-disable-next-line
    constructor(address _controller) EngalandBase(_controller) {}

    /**
    * @notice Initialize Token Manager
    * @param _stakeHolder   the address of the deployed stakeHolders
    * @param _seedSale      the address of the deployed seedSale
    */
    function initialize(
        address _stakeHolder,
        address _seedSale
    )
        external
        onlyInitializer
    {
        _initialize();

        Utils.enforceHasContractCode(_stakeHolder, "StakeHolder contract is not deployed");
        Utils.enforceHasContractCode(_seedSale, "SeedSale contract is not deployed");

        IController controller = IController(_msgSender());
        
        engaToken = IEngaToken(controller.engaToken());

        // mint 300_000 tokens for the initial sale, inital sale is not revocable and has its own vesting cliff period
        engaToken.mint(_seedSale, 300_000 ether);

        // vest 1,000,000 for dao treasury
        _createVesting(
            controller.treasury(),
            address(0), // by convention, address(0) refers to tokenManager itself and its state doesnt matter because these vestings are not revokable
            1_000_000 ether,
            getTimeNow(),
            getTimeNow() + 6 * MONTH,
            getTimeNow() + 12 * MONTH,
            false
        );

        // vest 1,700,000 token to the stake holders
        _createVesting(
            _stakeHolder,
            address(0), // by convention, address(0) refers to tokenManager itself and its state doesnt matter because these vestings are not revokable
            1_700_000 ether,
            getTimeNow(),
            getTimeNow() + 6 * MONTH,
            getTimeNow() + 2 * YEAR,
            false
        );
    }

    /* STATE MODIFIERS */
    
    /**
    * @notice create vested token
    * @param _beneficiary the address of the investor
    * @param _vestingCreator the address of the PreSale instance
    * @param _amount the amount of token invested [in wei]
    * @param _start starting time of the vesting [in seconds]
    * @param _cliff cliff time of vesting (must be added to starting before) [in seconds]
    * @param _end end time of vesting (must be added to starting before) [in seconds]
    * @param _revocable is vesting revokable or not
    */
    function createVesting(
        address _beneficiary,
        address _vestingCreator,
        uint256 _amount,
        uint256 _start,
        uint256 _cliff,
        uint256 _end,
        bool    _revocable
    )
        external
        onlyInitialized
        onlyRole(DEFAULT_ADMIN_ROLE)
        OnlyWhenVestingIsAllowed
        returns (bytes32 vestingId)
    {
        require(IPreSale(_vestingCreator).state() == SaleState.Funding);
        Utils.enforceHasContractCode(_vestingCreator, "TM: VESTING CREATOR MUST BE A DEPLOYED CONTRACT");
        Utils.enforceValidAddress(_beneficiary, "TM: BENEFICIARY CAN NOT BE ZERO ADDRESS");
        require(_start > 0 && _cliff > 0 && _end > 0, "TM: DURATION MUST BE > 0");
        require(_start < _cliff && _cliff <= _end, "TM: TIMES HAVE TO BE IN MEANINGFUL PERIOD");
        require(_amount > 0, "TM: AMOUNT MUST BE > 0");
        require(vestingsCount[_beneficiary] < MAX_VEST_PER_USER, "TM: THE VESTING LIMIT PER USER HAS REACHED");
        
        vestingId = _createVesting(_beneficiary, _vestingCreator,_amount, _start, _cliff, _end, _revocable);
    }

    /**
    * @notice Revokes the vesting for given identifier.
    * @param vestingId the vesting identifier
    */
    function revoke(bytes32 vestingId)
        external
        onlyInitialized
        onlyRole(DEFAULT_ADMIN_ROLE)
        onlyVestingNotRevoked(vestingId)
        nonReentrant
    {
        Vesting storage vesting = vestings[vestingId];
        
        require(vesting.revocable == true, "TM: VESTING IS NOT REVOKABLE");
        require(vesting.released == 0, "TM: VESTING IS NOT REVOKABLE");
        Utils.enforceHasContractCode(vesting.vestingCreator, "TM: VESTING CREATOR MUST BE A DEPLOYED CONTRACT");
        require(_isRevokeAllowed(vesting.vestingCreator), "TM: SALE STATE DOESNT MATCH");

        vesting.released =  vesting.amountTotal;
        vestingsTotalAmount = vestingsTotalAmount - vesting.amountTotal;
        vesting.revoked = true;
        
        /* NOTE we are checking the state of the sale of the vesting, so if it's in
        * refunding state then revoke could happen otherwise users can not revoke it
        * also in release case we are constantly checking the state of the sale again
        * to prevent users from releasing vesting which are at refund state and weren't
        * successfull
        */        
        engaToken.burn(address(this), vesting.amountTotal);

        emit VestingRevoked(vesting.beneficiary, vestingId, vesting.amountTotal);
    }

    /**
    * @notice Release vested amount of tokens.
    * @param vestingId the vesting  identifier
    */
    function release(bytes32 vestingId)
        external
        onlyInitialized
        onlyRole(DEFAULT_ADMIN_ROLE)
        onlyVestingNotRevoked(vestingId)
        nonReentrant
    {
        Vesting storage vesting = vestings[vestingId];
        
        require(_isReleaseAllowed(vesting.vestingCreator), "TM: SALE STATE DOESNT MATCH");

        uint256 amount = _releaseVesting(vesting);

        require(amount > 0, "TM: AMOUNT IS NOT ENOUGH TO RELEASE");

        // safeTransfer is called here, after modifying all states
        IERC20(engaToken).safeTransfer(vesting.beneficiary, amount);
        
        emit VestingReleased(vesting.beneficiary, vestingId, amount);
    }

    function mint(address _receiver, uint256 _amount) external onlyInitialized onlyRole(MINTER_ROLE) {
        engaToken.mint(_receiver, _amount);
    }

    function burn(address _burner, uint256 _amount) external onlyInitialized onlyRole(BURNER_ROLE) {
        engaToken.burn(_burner, _amount);
    }

    // NOTE this method closes vesting forever and no one can set it back to false
    function closeVestingProcess() external onlyInitialized onlyRole(DEFAULT_ADMIN_ROLE) {
        vestingLockedForEver = true;
    }

    /**
    * @notice Withdraw the specified amount if possible.
    * @param _amount the amount to withdraw
    */
    function withdraw(address _token, address _receiver, uint256 _amount)
        external
        onlyInitialized
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
    {
        Utils.enforceHasContractCode(_token, "TOKEN IS INVALID");
        require(_getWithdrawableAmount(_token) >= _amount, "TM: NOT ENOUGH WITHDRAWABLE TOKEN");
        
        IERC20(_token).safeTransfer(_receiver, _amount);
        emit Withdrawn(_receiver, _amount);
    }

    /* MODIFIERS */
    
    /**
    * @dev Reverts if no vesting  matches the passed identifier.
    */
    modifier onlyVestingExists(bytes32 vestingId) {
        require(vestings[vestingId].initialized == true);
        _;
    }

    /**
    * @dev Reverts if the vesting  does not exist or has been revoked.
    */
    modifier onlyVestingNotRevoked(bytes32 vestingId) {
        require(vestings[vestingId].initialized == true);
        require(vestings[vestingId].revoked == false);
        _;
    }

    /**
    * @dev Reverts if the vesting is over by the team
    */
    modifier OnlyWhenVestingIsAllowed() {
        require(vestingLockedForEver == false, "TM: VESTING IS NOT ALLOWED ANYNORE");
        _;
    }

    /* PUBLIC VIEWS */
    /**
    * @dev Returns true if closeVestingProcess() has been called
    * @return the status of vesting lock
    */
    function isVestingClosed() external view returns(bool) {
        return vestingLockedForEver;
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
        require(index < getVestingCount(), "TM: INDEX OUT OF THE BOUNDS");
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
    * @dev Returns the address of the ERC20 token
    */
    function getEngaToken() external view returns(address) {
        return address(engaToken);
    }

    /**
    * @dev Returns the number of vesting  managed by this contract.
    * @return the number of vesting 
    */
    function getVestingCount() public view returns(uint256) {
        return vestingsIds.length;
    }

    /**
    * @notice Computes the vested amount of tokens for the given vesting  identifier.
    * @return the vested amount
    */
    function computeReleasableAmount(bytes32 vestingId)
        public
        view
        onlyVestingNotRevoked(vestingId)
        returns(uint256)
    {
        return _computeReleasableAmount(vestings[vestingId]);
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

    /**
    * @dev Returns the amount of tokens that can be withdrawn by the owner.
    * @return the amount of tokens
    */
    function getWithdrawableAmount() external view returns(uint256) {
        return _getWithdrawableAmount(address(engaToken));
    }

    /**
    * @dev Computes the next vesting  identifier for a given holder address.
    */
    function computeNextId(address holder) public view returns(bytes32) {
        return computeId(holder, vestingsCount[holder]);
    }

    /**
    * @dev Returns the last vesting for a given holder address.
    */
    function getLastVestingForHolder(address holder) public view returns(Vesting memory) {
        require(vestingsCount[holder] > 0, "TM: THERE IS NO VESTING FOR THIS BENEFICIARY YET");
        return vestings[computeId(holder, vestingsCount[holder] - 1)];
    }

    /**
    * @dev Computes the vesting  identifier for an address and an index.
    */
    function computeId(address holder, uint256 index) public pure returns(bytes32) {
        return keccak256(abi.encodePacked(holder, index));
    }

    /* INTERNALS */

    function _isRevokeAllowed(address creator) internal view returns (bool) {
        if(IPreSale(creator).state() == SaleState.Refunding)
            return true;

        return false;
    }

    function _isReleaseAllowed(address creator) internal view returns (bool) {
        if (creator == address(0)) 
            return true;

        if(IPreSale(creator).state() == SaleState.Closed) {
            return true;
        }

        return false;
    }

    function _createVesting(
        address _beneficiary,
        address _vestingCreator,
        uint256 _amount, // in wei
        uint256 _start,  // in seconds
        uint256 _cliff,  // in seconds
        uint256 _end,    // in seconds
        bool _revocable
    )
        internal
        returns (bytes32 vestingId)
    {   
        vestingId = computeNextId(_beneficiary);
        vestings[vestingId] = Vesting(
            true,
            _beneficiary,
            _vestingCreator,
            _amount,
            0,
            _start,
            _cliff,
            _end,
            _revocable,
            false
        );
        
        vestingsTotalAmount = vestingsTotalAmount + _amount;
        vestingsIds.push(vestingId);
        vestingsCount[_beneficiary]++;
        
        // we are issuing this amount for future withdraw by the beneficiary
        // so there wont be shortage in token distribution
        _issue(_amount);

        emit VestingCreated(_beneficiary, vestingId, _amount);
    }
    
    function _releaseVesting(Vesting storage vesting) internal returns(uint256 amount) {
        amount = _computeReleasableAmount(vesting);
        
        if (amount == 0) return 0;
        
        vesting.released = vesting.released + amount;
        vestingsTotalAmount = vestingsTotalAmount - amount;
    }

    function _issue(uint256 _amount) internal {
        engaToken.mint(address(this), _amount);
    }

    /**
    * @dev Computes the releasable amount of tokens for a vesting. Computation starts right after cliff 
    * @return the amount of releasable tokens
    */
    function _computeReleasableAmount(Vesting storage vesting)
        internal
        view
        returns(uint256)
    {
        uint256 currentTime = getTimeNow();
        if (currentTime < vesting.cliff || vesting.revoked == true) {
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

    function _getWithdrawableAmount(address _token) internal view returns(uint256) {
        if (_token == address(engaToken)) {
            return engaToken.balanceOf(address(this)) - vestingsTotalAmount;
        } else {
            return IERC20(_token).balanceOf(address(this));
        }
    }
}