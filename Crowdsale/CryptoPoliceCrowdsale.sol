pragma solidity ^0.4.18;

import "./CrowdsaleToken.sol";
import "../Utils/Ownable.sol";
import "./../Utils/Math.sol";

// TODO: Burn leftover tokens
// TODO: Allow admin to transfer funds when min goal reached?
contract CryptoPoliceCrowdsale is Ownable {
    using MathUtils for uint;

    enum CrowdsaleState {
        Pending, Started, Ended, Paused
    }

    enum CrowdsaleStage {
        ClosedPresale, PublicPresale, Sale, LastChance
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
    
    CrowdsaleStage public stage = CrowdsaleStage.ClosedPresale;

    /**
     * Amount of wei each participant has spent in crowdsale
     */
    mapping(address => uint) public weiSpent;
    
    /**
     * Exchange tokens for Wei received
     */
    function () public payable {
        if (state == CrowdsaleState.Ended) {
            msg.sender.transfer(msg.value);
            refundContribution(msg.sender);
        } else {
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
    }

    /**
     * Command for owner to start crowdsale
     */
    function startCrowdsale(
        address crowdsaleToken,
        uint crowdsaleTokenVolume,
        uint softCap
    )
        public grantOwner
    {
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

    function pauseCrowdsale() public grantOwner {
        require(state == CrowdsaleState.Started);
        state = CrowdsaleState.Paused;
    }

    function unPauseCrowdsale() public grantOwner {
        require(state == CrowdsaleState.Paused);
        state = CrowdsaleState.Started;
    }

    /**
     * Command for owner to end crowdsale
     */
    function endCrowdsale() public grantOwner {
        require(state == CrowdsaleState.Started);
        
        state = CrowdsaleState.Ended;

        if (weiRaised >= MIN_GOAL) {
            owner.transfer(weiRaised);
        }
    }

    function startPublicPresaleStage() public grantOwner notEnded {
        require(stage == CrowdsaleStage.ClosedPresale);
        stage = CrowdsaleStage.PublicPresale;
    }

    function startSaleStage() public grantOwner notEnded {
        require(stage == CrowdsaleStage.PublicPresale);
        stage = CrowdsaleStage.Sale;
    }

    function startLastChanceStage() public grantOwner notEnded {
        require(stage == CrowdsaleStage.Sale);
        stage = CrowdsaleStage.LastChance;
    }

    /**
     * Allow crowdsale participant to get refunded
     */
    function refundContribution(address participant) internal {
        require(weiSpent[participant] > 0);
        require(weiRaised < MIN_GOAL);
        
        uint refundableAmount = weiSpent[participant];
        weiSpent[participant] = 0;

        msg.sender.transfer(refundableAmount);
    }

    function refund(address participant) public grantOwner {
        refundContribution(participant);
    }

    /**
     * Defines number of tokens and associated price in exchange
     */
    function exchange()
        internal view
        returns (uint batchSize, uint batchPrice)
    {
        batchSize = 100000;

        if (stage == CrowdsaleStage.ClosedPresale) {
            batchPrice = 18;
        } else if (stage == CrowdsaleStage.PublicPresale) {
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