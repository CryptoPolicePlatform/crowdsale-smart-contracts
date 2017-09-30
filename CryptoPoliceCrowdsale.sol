pragma solidity ^0.4.15;

import "MathUtils.sol";
import "Ownable.sol";

interface Token {
    function transfer(address destination, uint amount) public returns (bool);
}

contract CryptoPoliceCrowdsale is Ownable {
    using MathUtils for uint;

    enum CrowdsaleState {
        Pending, Started, Ended
    }
    
    /**
     * Minimum goal for this crowdsale of 1700 ether
     */
    uint public constant MIN_GOAL = 1700000000000000000000;

    /**
     * Amount of wei raised in this crowdsale
     */
    uint public fundsRaised = 0;

    /**
     * Token that will be sold
     */
    Token public token;
    
    /**
     * State in which the crowdsale is in
     */
    CrowdsaleState public state = CrowdsaleState.Pending;
    
    /**
     * Amount of wei each participant has spent in crowdsale
     */
    mapping(address => uint) public weiSpent;
    
    function CryptoPoliceCrowdsale(address cryptoPoliceToken) public {
        token = Token(cryptoPoliceToken);
    }
    
    /**
     * Exchange tokens for weis received
     */
    function () public payable {
        require(state == CrowdsaleState.Started);
        // TODO: Require min value for sale

        uint tokenAmount = 123; // TODO

        if (token.transfer(msg.sender, tokenAmount)) {
            fundsRaised = fundsRaised.add(msg.value);
            weiSpent[msg.sender] = weiSpent[msg.sender].add(msg.value);
        } else {
            revert();
        }
    }

    /**
     * Command for owner to start crowdsale
     */
    function start() public owned {
        require(state == CrowdsaleState.Pending);
        state = CrowdsaleState.Started;
    }

    function end() public owned {
        require(state == CrowdsaleState.Started);

        state = CrowdsaleState.Ended;

        if (fundsRaised >= MIN_GOAL) {
            owner.transfer(fundsRaised);
        }
    }

    /**
     * Allow crowdsale participant to get refunded
     */
    function refund() public {
        require(state == CrowdsaleState.Ended);
        require(weiSpent[msg.sender] > 0);
        require(fundsRaised < MIN_GOAL);
        
        uint amount = weiSpent[msg.sender];
        weiSpent[msg.sender] = 0;

        msg.sender.transfer(amount);
    }
}