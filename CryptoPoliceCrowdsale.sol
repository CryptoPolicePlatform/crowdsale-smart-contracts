pragma solidity ^0.4.18;

import "./MathUtils.sol";
import "./Ownable.sol";

// TODO: Rename to Token?
// TODO: Move to own file
interface CrowdsaleToken {
    function transfer(address destination, uint amount) public returns (bool);
    function totalSupply() public constant returns (uint);
    function balanceOf(address account) public constant returns (uint);
}

// TODO: Define max gas?
// TODO: Burn leftover tokens
// TODO: Refund a specific address
// TODO: Allow admin to transfer funds when min goal reached?
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
    uint public remainingCrowdsaleTokens;

    /**
     * When number of remaining crowdsale tokens reaches this number then
     * soft cap has been reached
     */
    uint public softCapTreshold;
    
    /**
     * Number of wei that has been gathered in sales so far
     */
    uint public weiRaised = 0;

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
     * Exchange tokens for Wei received
     */
    function () public payable {
        require(state == CrowdsaleState.Started);
        require(msg.value >= MIN_SALE);

        // get how many tokens must be exchanged per number of Wei
        var (batchSize, batchPrice) = exchange();

        require(remainingCrowdsaleTokens > batchSize);

        uint batches = msg.value / batchPrice;
        uint tokenAmount = batches * batchSize;

        // when we try to buy more than there is available
        if (tokenAmount > remainingCrowdsaleTokens) {
            // just because fraction of smallest unit cannot be exchanged
            // get even number of batches to exchange
            batches = remainingCrowdsaleTokens / batchSize;
            tokenAmount = batches * batchSize;
            state = CrowdsaleState.Ended;
        }

        uint spendableAmount = batches * batchPrice;
        uint refundable = msg.value - spendableAmount;
        
        if (refundable > 0) {
            msg.sender.transfer(refundable);
        }
        
        remainingCrowdsaleTokens = remainingCrowdsaleTokens.sub(tokenAmount);
        weiSpent[msg.sender] = weiSpent[msg.sender].add(spendableAmount);
        weiRaised = weiRaised.add(spendableAmount);
        
        if (softCapTreshold >= remainingCrowdsaleTokens) {
            stage = CrowdsaleStage.LastChance;
        }

        require(token.transfer(msg.sender, tokenAmount));
    }

    /**
     * Command for owner to start crowdsale
     */
    function start(address crowdsaleToken, uint crowdsaleTokenVolume, uint softCap) public owned {
        require(state == CrowdsaleState.Pending);
        token = CrowdsaleToken(crowdsaleToken);
        softCapTreshold = crowdsaleTokenVolume - softCap;
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

    function startPublicPreSale() public owned notEnded {
        require(stage == CrowdsaleStage.ClosedPreSale);
        stage = CrowdsaleStage.PublicPreSale;
    }

    function startSale() public owned notEnded {
        require(stage == CrowdsaleStage.PublicPreSale);
        stage = CrowdsaleStage.Sale;
    }

    function startLastChance() public owned notEnded {
        require(stage == CrowdsaleStage.Sale);
        stage = CrowdsaleStage.LastChance;
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

    function exchange() internal view returns (uint batchSize, uint batchPrice) {
        batchSize = 100000;

        if (stage == CrowdsaleStage.ClosedPreSale) {
            batchPrice = 18;
        } else if (stage == CrowdsaleStage.PublicPreSale) {
            batchPrice = 21;
        } else if (stage == CrowdsaleStage.Sale) {
            batchPrice = 25;
        } else if (stage == CrowdsaleStage.LastChance) {
            batchPrice = 28;
        } else {
            assert(false);
        }

        assert(batchSize > 0);
        assert(batchPrice > 0);
        assert(MIN_SALE >= batchPrice);
    }

    modifier notEnded {
        require(state != CrowdsaleState.Ended);
        _;
    }
}