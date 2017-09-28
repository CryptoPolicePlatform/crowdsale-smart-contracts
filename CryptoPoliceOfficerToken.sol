pragma solidity ^0.4.15;

/// ERC20 compliant token contract
contract CryptoPoliceOfficerToken {
    string public name;
    string public symbol;
    uint8 public decimals;
    
    uint256 public totalSupply;
    
    mapping(address => uint) balances;
    mapping(address => mapping (address => uint)) allowances;
    
    function CryptoPoliceOfficerToken(
        string tokenName,
        string tokenSymbol,
        uint8 tokenDecimals,
        uint tokenTotalSupply
    ) public {
        name = tokenName;
        symbol = tokenSymbol;
        decimals = tokenDecimals;
        totalSupply = tokenTotalSupply;
        balances[msg.sender] = tokenTotalSupply;
    }
    
    event Transfer(address indexed _from, address indexed _to, uint _value);
    event Approval(address indexed _owner, address indexed _spender, uint _value);

    function totalSupply() public constant returns (uint) {
        return totalSupply;
    }
    
    function balanceOf(address account) public constant returns (uint) {
        return balances[account];
    }
    
    function transfer(address destination, uint amount) public returns (bool) {
        if (
            amount > 0
            && balances[msg.sender] >= amount
            && balances[destination] + amount > balances[destination]
        ) {
            balances[msg.sender] -= amount;
            balances[destination] += amount;
            Transfer(msg.sender, destination, amount);
            return true;
        }
        
        return false;
    }
    
    function transferFrom(
        address account,
        address destination,
        uint amount
    ) public returns (bool) {
        if (
            amount > 0
            && balances[account] >= amount
            && allowances[account][msg.sender] >= amount
            && balances[destination] + amount > balances[destination]
        ) {
            balances[account] -= amount;
            allowances[account][msg.sender] -= amount;
            balances[destination] += amount;
            Transfer(account, destination, amount);
            
            return true;
        }
        
        return false;
    }
    
    function approve(address trustee, uint amount) public returns (bool) {
        allowances[msg.sender][trustee] = amount;
        Approval(msg.sender, trustee, amount);
        
        return true;
    }
    
    function allowance(address origin, address trustee) public constant returns (uint) {
        return allowances[origin][trustee];
    }
}