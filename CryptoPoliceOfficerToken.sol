pragma solidity ^0.4.15;

/// ERC20 compliant token contract
contract CryptoPoliceOfficerToken {
    string public name;
    string public symbol;
    uint8 public decimals = 8;
    
    uint256 public totalSupply;
    
    mapping(address => uint) balances;
    mapping(address => mapping (address => uint)) allowances;
    
    event Transfer(
        address indexed fromAccount,
        address indexed destination,
        uint amount
    );
    
    event Approval(
        address indexed fromAccount,
        address indexed destination,
        uint amount
    );
    
    function CryptoPoliceOfficerToken(
        string tokenName,
        string tokenSymbol,
        uint tokenTotalSupply
    ) public {
        name = tokenName;
        symbol = tokenSymbol;
        totalSupply = tokenTotalSupply;
        balances[msg.sender] = tokenTotalSupply;
    }

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
        address source,
        address destination,
        uint amount
    ) public returns (bool) {
        if (
            amount > 0
            && balances[source] >= amount
            && allowances[source][msg.sender] >= amount
            && balances[destination] + amount > balances[destination]
        ) {
            balances[source] -= amount;
            allowances[source][msg.sender] -= amount;
            balances[destination] += amount;
            Transfer(source, destination, amount);
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Allow destination address to withdraw funds from account that is caller
     * of this function
     *
     * @param destination The one who receives permission
     * @param amount How much funds can be withdrawn
     * @return Whether or not approval was successful
     */
    function approve(
        address destination,
        uint amount
    ) public returns (bool) {
        allowances[msg.sender][destination] = amount;
        Approval(msg.sender, destination, amount);
        
        return true;
    }
    
    function allowance(
        address fromAccount,
        address destination
    ) public constant returns (uint) {
        return allowances[fromAccount][destination];
    }
}