pragma solidity ^0.5.3;

contract Balance {
    mapping(address => uint) public balances;

    // ERC20 function
    function balanceOf(address account) public view returns (uint) {
        return balances[account];
    }

    modifier hasSufficientBalance(address account, uint balance) {
        require(balances[account] >= balance);
        _;
    }
} 