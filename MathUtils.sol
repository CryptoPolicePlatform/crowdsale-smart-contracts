pragma solidity ^0.4.15;

// TODO: Implement safe math
library MathUtils {
    function add(uint a, uint b) internal constant returns (uint) {
        uint result = a + b;

        require(result >= a);

        return result;
    }

    function sub(uint a, uint b) internal constant returns (uint) {
        // TODO: Check for owerflows
        return a - b;
    }

    function mul(uint a, uint b) internal constant returns (uint) {
        // TODO: Check for owerflows
        return a * b;
    }
}