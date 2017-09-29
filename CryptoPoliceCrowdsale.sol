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
        uint tokenAmount = 123; // TODO
        if (token.transfer(msg.sender, tokenAmount)) {
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
}