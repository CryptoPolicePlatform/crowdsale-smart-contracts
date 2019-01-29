pragma solidity ^0.5.3;

library StringUtils {
    function equals(string memory s1, string memory s2) internal pure returns (bool) {
        bytes memory b1 = bytes(s1);
        bytes memory b2 = bytes(s2);

        if (b1.length != b2.length) {
            return false;
        }

        for (uint i = 0; i < b1.length; i++) {
            if (b1[i] != b2[i]) {
                return false;
            }
        }

        return true;
    }
}