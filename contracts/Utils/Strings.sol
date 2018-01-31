pragma solidity ^0.4.19;

library StringUtils {
    function equals(string s1, string s2) internal pure returns (bool) {
        var b1 = bytes(s1);
        var b2 = bytes(s2);

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