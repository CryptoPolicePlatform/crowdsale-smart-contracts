pragma solidity ^0.4.18;

contract Balance {
    mapping(address => uint) public balances;

    // ERC20 function
    function balanceOf(address account) public constant returns (uint) {
        return balances[account];
    }

    modifier requiresSufficientBalance(address account, uint balance) {
        require(balances[account] >= balance);
        _;
    }
} 