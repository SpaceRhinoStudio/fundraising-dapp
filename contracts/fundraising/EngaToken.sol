/**
* ENGA Federation ENGA Token.
* @author Mehdikovic
* Date created: 2022.03.02
* Github: mehdikovic
* SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { IERC223 } from "../interfaces/fundraising/IERC223.sol";
import { IEngaToken } from "../interfaces/fundraising/IEngaToken.sol";
import {EngalandBase} from "../common/EngalandBase.sol";

contract EngaToken is EngalandBase, ERC20, IEngaToken {
    /**
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    */
    bytes32 public constant MINTER_ROLE = 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6;
    bytes32 public constant BURNER_ROLE = 0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848;

    string private constant ERROR_CONTRACT_HAS_ZERO_ADDRESS = "ERROR_CONTRACT_HAS_ZERO_ADDRESS";
    string private constant PERMIT_DEADLINE_EXPIRED         = "PERMIT_DEADLINE_EXPIRED";
    string private constant INVALID_SIGNER                  = "INVALID_SIGNER";

    // solhint-disable var-name-mixedcase
    uint256 internal immutable INITIAL_CHAIN_ID;
    bytes32 internal immutable INITIAL_DOMAIN_SEPARATOR;
    mapping(address => uint256) public nonces;

    constructor(address _controller) ERC20("Enga", "ENGA") EngalandBase(_controller) {
        _initialize();
        INITIAL_CHAIN_ID = block.chainid;
        INITIAL_DOMAIN_SEPARATOR = _computeDomainSeparator();
    }

    /* STATE MODIFIERS */
    
    function mint(address _receiver, uint256 _amount) external onlyRole(MINTER_ROLE) {
        _mint(_receiver, _amount);
        emit Minted(_receiver, _amount);
    }

    function burn(address _burner, uint256 _amount) external onlyRole(BURNER_ROLE) {
        _burn(_burner, _amount);
        emit Burned(_burner, _amount);
    }

    /*//////////////////////////////////////////////////////////////
                             EIP-223 LOGIC
    //////////////////////////////////////////////////////////////*/

    function transfer(address _to, uint256 _amount, bytes calldata _data) external returns (bool) {
        address owner = _msgSender();
        _transfer(owner, _to, _amount);
        
        bool isContract = false;
        
        // solhint-disable no-inline-assembly
        assembly {
            isContract := not(iszero(extcodesize(_to)))
        }
        
        if (isContract) {
            IERC223(_to).tokenFallback(owner, _amount, _data);
        }
        return true;
    }

    /*//////////////////////////////////////////////////////////////
                             EIP-2612 LOGIC
    //////////////////////////////////////////////////////////////*/

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(deadline >= block.timestamp, PERMIT_DEADLINE_EXPIRED);

        // Unchecked because the only math done is incrementing
        // the owner's nonce which cannot realistically overflow.
        unchecked {
            address recoveredAddress = ecrecover(
                keccak256(
                    abi.encodePacked(
                        "\x19\x01",
                        DOMAIN_SEPARATOR(),
                        keccak256(
                            abi.encode(
                                keccak256(
                                    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                                ),
                                owner,
                                spender,
                                value,
                                nonces[owner]++,
                                deadline
                            )
                        )
                    )
                ),
                v,
                r,
                s
            );

            require(recoveredAddress != address(0) && recoveredAddress == owner, INVALID_SIGNER);
            _approve(recoveredAddress, spender, value);
        }

        emit Approval(owner, spender, value);
    }

    // solhint-disable func-name-mixedcase
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return block.chainid == INITIAL_CHAIN_ID ? INITIAL_DOMAIN_SEPARATOR : _computeDomainSeparator();
    }

    function _computeDomainSeparator() internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                    keccak256(bytes(name())),
                    keccak256("1"),
                    block.chainid,
                    address(this)
                )
            );
    }
}