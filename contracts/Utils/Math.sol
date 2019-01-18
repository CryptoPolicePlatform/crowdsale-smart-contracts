pragma solidity ^0.5.2;

library MathUtils {
    function add(uint a, uint b) internal pure returns (uint) {
        uint result = a + b;

        if (a == 0 || b == 0) {
            return result;
        }

        require(result > a && result > b);

        return result;
    }

    function sub(uint a, uint b) internal pure returns (uint) {
        require(a >= b);

        return a - b;
    }

    function mul(uint a, uint b) internal pure returns (uint) {
        if (a == 0 || b == 0) {
            return 0;
        }

        uint result = a * b;

        require(result / a == b);

        return result;
    }
}