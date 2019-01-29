pragma solidity ^0.5.2;

library AddressUtils {
    function notNull(address a) internal pure returns (bool) {
        return a != address(0);
    }
}