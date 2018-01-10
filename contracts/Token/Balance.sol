pragma solidity ^0.4.19;

contract Balance {
    mapping(address => uint) public balances;

    // ERC20 function
    function balanceOf(address account) public constant returns (uint) {
        return balances[account];
    }

    modifier hasSufficientBalance(address account, uint balance) {
        require(balances[account] >= balance);
        _;
    }
} 