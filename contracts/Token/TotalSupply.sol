pragma solidity ^0.4.23;

contract TotalSupply {
    uint public totalSupply = 1000000000 * 10**18;

    // ERC20 function
    function totalSupply() external constant returns (uint) {
        return totalSupply;
    }
}