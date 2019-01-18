pragma solidity ^0.5.2;

import "./../Utils/Math.sol";
import "./TotalSupply.sol";
import "./Burnable.sol";
import "./Balance.sol";
import "./TokenRecipient.sol";

/// ERC20 compliant token contract
contract CryptoPoliceOfficerToken is TotalSupply, Balance, Burnable {
    using MathUtils for uint;

    string public name;
    string public symbol;
    uint8 public decimals = 18;

    mapping(address => mapping(address => uint)) allowances;
    
    bool public publicTransfersEnabled = false;
    uint public releaseStartTime;

    uint public lockedAmount;
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
    
    constructor(
        string memory tokenName,
        string memory tokenSymbol
    )
        public
    {
        name = tokenName;
        symbol = tokenSymbol;
        balances[msg.sender] = totalSupply;
    }
    
    function _transfer(
        address source,
        address destination,
        uint amount
    )
        internal
        hasSufficientBalance(source, amount)
        whenTransferable(destination)
        hasUnlockedAmount(source, amount)
    {
        require(destination != address(this) && destination != address(0));

        if (amount > 0) {
            balances[source] -= amount;
            balances[destination] = balances[destination].add(amount);
        }

        emit Transfer(source, destination, amount);
    }

    function transfer(address destination, uint amount)
    public returns (bool)
    {
        _transfer(msg.sender, destination, amount);
        return true;
    }

    function transferFrom(
        address source,
        address destination,
        uint amount
    )
        public returns (bool)
    {
        require(allowances[source][msg.sender] >= amount);

        allowances[source][msg.sender] -= amount;

        _transfer(source, destination, amount);
        
        return true;
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
        emit Approval(msg.sender, destination, amount);
        
        return true;
    }
    
    function allowance(
        address fromAccount,
        address destination
    )
        public view returns (uint)
    {
        return allowances[fromAccount][destination];
    }

    function approveAndCall(
        address _spender,
        uint256 _value,
        bytes memory _extraData
    )
        public
        returns (bool)
    {
        TokenRecipient spender = TokenRecipient(_spender);

        if (approve(_spender, _value)) {
            spender.receiveApproval(msg.sender, _value, address(this), _extraData);
            return true;
        }

        return false;
    }

    function enablePublicTransfers()
    public grantOwner
    {
        require(crowdsaleSuccessful());
        
        publicTransfersEnabled = true;
        releaseStartTime = now;
    }

    function addTokenLock(uint amount, uint timespan)
    public grantOwner
    {
        require(releaseStartTime == 0);
        requireOwnerUnlockedAmount(amount);

        locks.push(TokenLock({
            amount: amount,
            timespan: timespan,
            released: false
        }));

        lockedAmount += amount;
    }

    function releaseLockedTokens(uint8 idx)
    public grantOwner
    {
        require(releaseStartTime > 0);
        require(!locks[idx].released);
        require((releaseStartTime + locks[idx].timespan) < now);

        locks[idx].released = true;
        lockedAmount -= locks[idx].amount;
    }

    function requireOwnerUnlockedAmount(uint amount)
    internal view
    {
        require(balanceOf(owner).sub(lockedAmount) >= amount);
    }

    function setCrowdsaleContract(address crowdsale)
    public grantOwner
    {
        super.setCrowdsaleContract(crowdsale);
        transfer(crowdsale, getCrowdsaleHardCap());
    }

    modifier hasUnlockedAmount(address account, uint amount) {
        if (owner == account) {
            requireOwnerUnlockedAmount(amount);
        }
        _;
    }

    modifier whenTransferable(address destination) {
        require(publicTransfersEnabled || isCrowdsale() || (isOwner() && addressIsCrowdsale(destination) && balanceOf(crowdsaleContract) == 0) || (isOwner() && !crowdsaleSet()));
        _;
    }
}