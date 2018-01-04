pragma solidity ^0.4.18;

import "./../Utils/Math.sol";
import "./TotalSupply.sol";
import "./Burnable.sol";
import "./Balance.sol";

// TODO: Suspend owner tokens for x number of days
/// ERC20 compliant token contract
contract CryptoPoliceOfficerToken is TotalSupply, Balance, Burnable {
    using MathUtils for uint;

    string public name;
    string public symbol;
    uint8 public decimals = 18;

    mapping(address => mapping(address => uint)) allowances;
    
    bool public publicTransfersEnabled = false;
    uint public releaseStartTime;

    uint lockedAmount;
    TokenLock[] public locks;

    struct TokenLock {
        uint amount;
        uint timespan;
        bool released;
    }

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
        string tokenSymbol
    )
        public
    {
        name = tokenName;
        symbol = tokenSymbol;
        balances[msg.sender] = totalSupply;
    }
    
    function transfer(address destination, uint amount)
    public hasSufficientBalance(msg.sender, amount) whenTransferable hasUnlockedAmount(msg.sender, amount)
    returns (bool)
    {
        require(destination != address(this));

        if (amount > 0) {
            balances[msg.sender] -= amount;
            balances[destination] = balances[destination].add(amount);
            Transfer(msg.sender, destination, amount);
            return true;
        }
        
        return false;
    }

    function transferFrom(
        address source,
        address destination,
        uint amount
    )
        public hasSufficientBalance(source, amount) whenTransferable hasUnlockedAmount(source, amount)
        returns (bool)
    {
        require(allowances[source][msg.sender] >= amount);
        
        if (amount > 0) {
            balances[source] -= amount;
            allowances[source][msg.sender] -= amount;
            balances[destination] = balances[destination].add(amount);
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
    )
        public returns (bool)
    {
        allowances[msg.sender][destination] = amount;
        Approval(msg.sender, destination, amount);
        
        return true;
    }
    
    function allowance(
        address fromAccount,
        address destination
    )
        public constant returns (uint)
    {
        return allowances[fromAccount][destination];
    }

    function enablePublicTransfers() public grantOwner {
        publicTransfersEnabled = true;
        releaseStartTime = now;
    }

    function returnTokens(address _address) public returns (uint) {
        require(isCrowdsale());
        require(publicTransfersEnabled == false);
        uint balance = balanceOf(_address);
        require(balance > 0);
        balances[_address] = 0;
        balances[crowdsaleContract] = balances[crowdsaleContract].add(balance);
        Transfer(_address, crowdsaleContract, balance);
        return balance;
    }

    function addTokenLock(uint amount, uint timespan) public grantOwner {
        locks.push(TokenLock({
            amount: amount,
            timespan: timespan,
            released: false
        }));

        lockedAmount += amount;
    }

    function releaseLockedTokens(uint8 idx) public grantOwner {
        require(releaseStartTime > 0);
        require(!locks[idx].released);
        require((releaseStartTime + locks[idx].timespan) < now);

        locks[idx].released = true;
        lockedAmount -= locks[idx].amount;
    }

    modifier hasUnlockedAmount(address account, uint amount) {
        if (owner == account) {
            require(balanceOf(owner).sub(lockedAmount) >= amount);
        }
        _;
    }

    modifier whenTransferable {
        require(publicTransfersEnabled || isCrowdsale() || isOwner());
        _;
    }
}