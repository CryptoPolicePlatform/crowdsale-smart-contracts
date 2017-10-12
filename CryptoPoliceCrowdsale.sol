pragma solidity ^0.4.15;

import "MathUtils.sol";
import "Ownable.sol";

interface CrowdsaleToken {
    function transfer(address destination, uint amount) public returns (bool);
    function totalSupply() public constant returns (uint);
    function balanceOf(address account) public constant returns (uint);
}

contract CryptoPoliceCrowdsale is Ownable {
    using MathUtils for uint;

    enum CrowdsaleState {
        Pending, Started, Ended, Paused
    }

    enum CrowdsaleStage {
        ClosedPreSale, PublicPreSale, Sale, LastChance
    }
    
    /**
     * Minimum goal for this crowdsale
     */
    uint public constant MIN_GOAL = 1700 ether;

    /**
     * Minimum number of wei that can be exchanged for tokens
     */
    uint public constant MIN_SALE = 0.01 ether;

    /**
     * Number of tokens that can be purchased
     */
    uint internal remainingCrowdsaleTokens;
    
    /**
     * Number of wei that has been gathered in sales so far
     */
    uint internal weiRaised = 0;

    /**
     * Token that will be sold
     */
    CrowdsaleToken public token;
    
    /**
     * State in which the crowdsale is in
     */
    CrowdsaleState public state = CrowdsaleState.Pending;
    
    CrowdsaleStage public stage = CrowdsaleStage.ClosedPreSale;

    /**
     * Amount of wei each participant has spent in crowdsale
     */
    mapping(address => uint) public weiSpent;
    
    /**
     * Exchange tokens for weis received
     */
    function () public payable {
        require(state == CrowdsaleState.Started);
        require(msg.value >= MIN_SALE);
        require(remainingCrowdsaleTokens > 0);

        var (tokens, weis) = exchange();

        require(remainingCrowdsaleTokens > tokens);

        uint tokenAmount = msg.value / weis * tokens;

        // when we try to buy more than there is available
        if (tokenAmount > remainingCrowdsaleTokens) {
            tokenAmount = (remainingCrowdsaleTokens / tokens) * tokens;
        }

        uint spendableAmount = tokenAmount * weis;
        uint refundable = msg.value - spendableAmount;
        
        if (refundable > 0) {
            msg.sender.transfer(refundable);
        }
        
        remainingCrowdsaleTokens = remainingCrowdsaleTokens.sub(tokenAmount);
        
        require(token.transfer(msg.sender, tokenAmount));

        weiRaised = weiRaised.add(spendableAmount);
        weiSpent[msg.sender] = weiSpent[msg.sender].add(spendableAmount);
    }

    /**
     * Command for owner to start crowdsale
     */
    function start(address crowdsaleToken, uint crowdsaleTokenVolume) public owned {
        require(state == CrowdsaleState.Pending);
        token = CrowdsaleToken(crowdsaleToken);
        remainingCrowdsaleTokens = crowdsaleTokenVolume;
        // number of tokens required for this crowdsale operation
        // including purchaseable tokens, bounty tokens etc.
        uint allocation = remainingCrowdsaleTokens;
        require(token.balanceOf(address(this)) == allocation);
        state = CrowdsaleState.Started;
    }

    function pause() public owned {
        require(state == CrowdsaleState.Started);
        state = CrowdsaleState.Paused;
    }

    function unPause() public owned {
        require(state == CrowdsaleState.Paused);
        state = CrowdsaleState.Started;
    }

    /**
     * Command for owner to end crowdsale
     */
    function end() public owned {
        require(state == CrowdsaleState.Started);
        
        state = CrowdsaleState.Ended;

        if (weiRaised >= MIN_GOAL) {
            owner.transfer(weiRaised);
        }
    }

    function startPublicPreSale() public owned {
        require(stage == CrowdsaleStage.ClosedPreSale);
        stage = CrowdsaleStage.PublicPreSale;
    }

    function startSale() public owned {
        require(stage == CrowdsaleStage.PublicPreSale);
        stage = CrowdsaleStage.Sale;
    }

    /**
     * Allow crowdsale participant to get refunded
     */
    function refund() public {
        require(state == CrowdsaleState.Ended);
        require(weiSpent[msg.sender] > 0);
        require(weiRaised < MIN_GOAL);
        
        uint refundableAmount = weiSpent[msg.sender];
        weiSpent[msg.sender] = 0;

        msg.sender.transfer(refundableAmount);
    }

    function exchange() internal returns (uint tokens, uint weis) {
        tokens = 100000;

        if (stage == CrowdsaleStage.ClosedPreSale) {
            weis = 13;
        } else if (stage == CrowdsaleStage.PublicPreSale) {
            weis = 16;
        } else if (stage == CrowdsaleStage.Sale) {
            weis = 20;
        } else if (stage == CrowdsaleStage.LastChance) {
            weis = 25;
        } else {
            assert(false);
        }

        assert(tokens > 0);
        assert(weis > 0);
        assert(MIN_SALE >= weis);
    }
}