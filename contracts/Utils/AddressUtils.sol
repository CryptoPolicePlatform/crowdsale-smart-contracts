pragma solidity ^0.5.3;

library AddressUtils {
    function notNull(address a) internal pure returns (bool) {
        return a != address(0);
    }
}