pragma solidity ^0.4.19;

contract TotalSupply {
    uint public totalSupply = 1000000000 * 10**18;

    // ERC20 function
    function totalSupply() public constant returns (uint) {
        return totalSupply;
    }
}