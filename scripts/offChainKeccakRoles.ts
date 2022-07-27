import { ethers } from "hardhat";

const id = (name: string) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(name));

export const BYTES32_ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000'
export const TRANSFER_ROLE = id("TRANSFER_ROLE");
export const TREASURY_TRANSFER_ROLE = id("TREASURY_TRANSFER_ROLE");
export const CHANGE_DAILY_LIMIT_ROLE = id("CHANGE_DAILY_LIMIT_ROLE");
export const MINTER_ROLE = id("MINTER_ROLE");
export const BURNER_ROLE = id("BURNER_ROLE");
export const CLOSE_VESTING_PROCESS_ROLE = id("CLOSE_VESTING_PROCESS_ROLE");
export const VESTING_ROLE = id("VESTING_ROLE");
export const CONTRIBUTION_ROLE = id("CONTRIBUTION_ROLE");
export const WITHDRAW_ROLE = id("WITHDRAW_ROLE");
export const REVOKE_ROLE = id("REVOKE_ROLE");
export const RELEASE_ROLE = id("RELEASE_ROLE");
export const OPEN_ROLE = id("OPEN_ROLE");
export const SUSPEND_ROLE = id("SUSPEND_ROLE");
export const UPDATE_FORMULA_ROLE = id("UPDATE_FORMULA_ROLE");
export const UPDATE_TREASURY_ROLE = id("UPDATE_TREASURY_ROLE");
export const UPDATE_BENEFICIARY_ROLE = id("UPDATE_BENEFICIARY_ROLE");
export const ADD_TAPPED_TOKEN_ROLE = id("ADD_TAPPED_TOKEN_ROLE")
export const UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE = id("UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE")
export const UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE = id("UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE")
export const REMOVE_TAPPED_TOKEN_ROLE = id("REMOVE_TAPPED_TOKEN_ROLE")
export const UPDATE_TAPPED_TOKEN_ROLE = id("UPDATE_TAPPED_TOKEN_ROLE")
export const RESET_TAPPED_TOKEN_ROLE = id("RESET_TAPPED_TOKEN_ROLE")
export const ADD_COLLATERAL_TOKEN_ROLE = id("ADD_COLLATERAL_TOKEN_ROLE")
export const REMOVE_COLLATERAL_TOKEN_ROLE = id("REMOVE_COLLATERAL_TOKEN_ROLE")
export const UPDATE_COLLATERAL_TOKEN_ROLE = id("UPDATE_COLLATERAL_TOKEN_ROLE")
export const UPDATE_FEES_ROLE = id("UPDATE_FEES_ROLE")
export const OPEN_BUY_ORDER_ROLE = id("OPEN_BUY_ORDER_ROLE")
export const OPEN_SELL_ORDER_ROLE = id("OPEN_SELL_ORDER_ROLE")
export const ENABLE_KYC_ROLE = id("ENABLE_KYC_ROLE");
export const DISABLE_KYC_ROLE = id("DISABLE_KYC_ROLE");
export const ADD_KYC_ROLE = id("ADD_KYC_ROLE");
export const REMOVE_KYC_ROLE = id("REMOVE_KYC_ROLE");
export const TEMP = id("TEMP");



console.log(); console.log("TRANSFER_ROLE..............................=> ", TRANSFER_ROLE);
console.log(); console.log("TREASURY_TRANSFER_ROLE.....................=> ", TREASURY_TRANSFER_ROLE);
console.log(); console.log("CHANGE_DAILY_LIMIT_ROLE....................=> ", CHANGE_DAILY_LIMIT_ROLE);
console.log(); console.log("MINTER_ROLE................................=> ", MINTER_ROLE);
console.log(); console.log("BURNER_ROLE................................=> ", BURNER_ROLE);
console.log(); console.log("CLOSE_VESTING_PROCESS_ROLE.................=> ", CLOSE_VESTING_PROCESS_ROLE);
console.log(); console.log("VESTING_ROLE...............................=> ", VESTING_ROLE);
console.log(); console.log("CONTRIBUTION_ROLE..........................=> ", CONTRIBUTION_ROLE);
console.log(); console.log("WITHDRAW_ROLE..............................=> ", WITHDRAW_ROLE);
console.log(); console.log("REVOKE_ROLE................................=> ", REVOKE_ROLE);
console.log(); console.log("RELEASE_ROLE...............................=> ", RELEASE_ROLE);
console.log(); console.log("OPEN_ROLE..................................=> ", OPEN_ROLE);
console.log(); console.log("SUSPEND_ROLE...............................=> ", SUSPEND_ROLE);
console.log(); console.log("UPDATE_FORMULA_ROLE........................=> ", UPDATE_FORMULA_ROLE);
console.log(); console.log("ADD_TAPPED_TOKEN_ROLE......................=> ", ADD_TAPPED_TOKEN_ROLE);
console.log(); console.log("UPDATE_TREASURY_ROLE.......................=> ", UPDATE_TREASURY_ROLE);
console.log(); console.log("UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE..=> ", UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE);
console.log(); console.log("UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE.=> ", UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE);
console.log(); console.log("REMOVE_TAPPED_TOKEN_ROLE...................=> ", REMOVE_TAPPED_TOKEN_ROLE);
console.log(); console.log("UPDATE_TAPPED_TOKEN_ROLE...................=> ", UPDATE_TAPPED_TOKEN_ROLE);
console.log(); console.log("RESET_TAPPED_TOKEN_ROLE....................=> ", RESET_TAPPED_TOKEN_ROLE);
console.log(); console.log("ADD_COLLATERAL_TOKEN_ROLE..................=> ", ADD_COLLATERAL_TOKEN_ROLE);
console.log(); console.log("REMOVE_COLLATERAL_TOKEN_ROLE...............=> ", REMOVE_COLLATERAL_TOKEN_ROLE);
console.log(); console.log("UPDATE_COLLATERAL_TOKEN_ROLE...............=> ", UPDATE_COLLATERAL_TOKEN_ROLE);
console.log(); console.log("UPDATE_FEES_ROLE...........................=> ", UPDATE_FEES_ROLE);
console.log(); console.log("OPEN_BUY_ORDER_ROLE........................=> ", OPEN_BUY_ORDER_ROLE);
console.log(); console.log("OPEN_SELL_ORDER_ROLE.......................=> ", OPEN_SELL_ORDER_ROLE);
console.log(); console.log("ENABLE_KYC_ROLE............................=> ", ENABLE_KYC_ROLE);
console.log(); console.log("DISABLE_KYC_ROLE...........................=> ", DISABLE_KYC_ROLE);
console.log(); console.log("ADD_KYC_ROLE...............................=> ", ADD_KYC_ROLE);
console.log(); console.log("REMOVE_KYC_ROLE............................=> ", REMOVE_KYC_ROLE);
console.log(); console.log("TEMP.......................................=> ", TEMP);