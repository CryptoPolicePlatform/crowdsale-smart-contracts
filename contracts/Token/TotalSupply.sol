pragma solidity ^0.4.18;

contract TotalSupply {
    uint public totalSupply = 1000000000000000000000000000;

    // ERC20 function
    function totalSupply() public constant returns (uint) {
        return totalSupply;
    }
}