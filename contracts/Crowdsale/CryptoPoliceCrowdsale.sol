pragma solidity ^0.4.18;

import "./CrowdsaleToken.sol";
import "../Utils/Ownable.sol";
import "./../Utils/Math.sol";

// TODO: Automatic stage change based on sold out token volume
contract CryptoPoliceCrowdsale is Ownable {
    using MathUtils for uint;

    enum CrowdsaleState {
        Pending, Started, Ended, Paused, SoldOut
    }

    enum CrowdsaleStage {
        TokenReservation, ClosedPresale, PublicPresale, Sale, LastChance
    }

    struct ExchangeRate {
        uint tokens;
        uint price;
    }

    uint public constant MIN_CAP = 12500000 * 10**18;
    uint public constant SOFT_CAP = 40000000 * 10**18;
    uint public constant POWER_CAP = 160000000 * 10**18;
    uint public constant HARD_CAP = 400000000 * 10**18;

    uint public tokensExchanged;

    /**
     * Minimum number of wei that can be exchanged for tokens
     */
    uint public minSale = 0.01 ether;
    
    /**
     * Number of wei that has been gathered in sales so far
     */
    uint public weiRaised = 0;

    uint public weiTransfered = 0;

    /**
     * Token that will be sold
     */
    CrowdsaleToken public token;
    
    /**
     * State in which the crowdsale is in
     */
    CrowdsaleState public state = CrowdsaleState.Pending;
    
    CrowdsaleStage public stage = CrowdsaleStage.TokenReservation;

    /**
     * Amount of wei each participant has spent in crowdsale
     */
    mapping(address => uint) public weiSpent;

    mapping(address => bool) public identifiedAddresses;

    mapping(address => uint) public suspended;

    /**
     * Map stage to its corresponding exchange rate
     */
    mapping(uint8 => ExchangeRate) exchangeRates;
    
    bool public crowdsaleEndedSuccessfully = false;

    uint public maxUnidentifiedInvestment = 25 ether;

    /**
     * Exchange tokens for Wei received
     */
    function () public payable {
        if (state == CrowdsaleState.Ended) {
            msg.sender.transfer(msg.value);
            refundContribution(msg.sender);
        } else {
            require(state == CrowdsaleState.Started);
            exchange(msg.sender, msg.value);
        }
    }

    function exchange(address sender, uint weiSent) internal {
        require(weiSent >= minSale);

        if (trySuspend(sender, weiSent)) {
            return;
        }

        uint tokens;
        uint weiExchanged;
        uint weiRemaining = weiSent;

        while (true) {
            var (batchSize, batchPrice) = exchangeRate();
            
            uint batches = weiRemaining / batchPrice;
            uint tokenAmount = batches.mul(batchSize);
            uint stageCap = getStageCap();
            
            if (tokenAmount > stageCap) {
                // we have to exchange remainder for current rate
                uint remainder = stageCap - tokensExchanged;

                // how many tokens can be exchanged
                batches = remainder / batchSize;

                if (batches > 0) {
                    tokens = tokens + batches * batchSize;
                    weiExchanged = batches * batchPrice;
                    weiRemaining = weiRemaining - weiExchanged;
                    tokensExchanged = tokensExchanged + tokens;
                }

                enterNextStage();

                if (stageCap == HARD_CAP) {
                    state = CrowdsaleState.SoldOut;
                    break;
                }
                
                continue;
            }

            tokens = tokens + tokenAmount;
            weiExchanged = batches * batchPrice;
            weiRemaining = weiRemaining - weiExchanged;
            tokensExchanged = tokensExchanged + tokens;
            
            if (stageCap == HARD_CAP) {
                state = CrowdsaleState.SoldOut;
            }

            break;
        }

        if (weiRemaining > 0) {
            sender.transfer(weiRemaining);
        }

        weiSpent[sender] = weiSpent[sender] + weiExchanged;
        weiRaised = weiRaised + weiExchanged;

        require(token.transferFrom(owner, sender, tokens));
    }

    /**
     * Intended when other currencies are received and owner has to carry out exchange
     * for those funds aligned to Wei
     */
    function proxyExchange(address sender, uint weiSent) public grantOwner {
        exchange(sender, weiSent);
    }

    /**
     * Command for owner to start crowdsale
     */
    function startCrowdsale(address crowdsaleToken) public grantOwner {
        require(state == CrowdsaleState.Pending);
        token = CrowdsaleToken(crowdsaleToken);
        require(token.allowance(owner, address(this)) == HARD_CAP);
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
    function endCrowdsale(bool success) public grantOwner notEnded {
        state = CrowdsaleState.Ended;
        crowdsaleEndedSuccessfully = success;

        if (success) {
            transferFunds(owner, weiRaised - weiTransfered);
        }
    }

    function startClosedPresaleStage() public grantOwner notEnded {
        require(stage == CrowdsaleStage.TokenReservation);
        stage = CrowdsaleStage.ClosedPresale;
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

    function markAddressIdentified(address _address) public grantOwner notEnded {
        identifiedAddresses[_address] = true;

        if (suspended[_address] > 0) {
            exchange(_address, suspended[_address]);
            suspended[_address] = 0;
        }
    }

    function returnSuspendedFunds(address _address) public grantOwner {
        if (suspended[_address] > 0) {
            _address.transfer(suspended[_address]);
        }
    }

    function transferFunds(address recipient, uint weiAmount) public grantOwner {
        require(tokensExchanged >= MIN_CAP);
        require(weiRaised > weiTransfered);
        require((weiRaised - weiTransfered) >= weiAmount);

        weiTransfered = weiTransfered + weiAmount;
        recipient.transfer(weiAmount);
    }

    function updateMaxUnidentifiedInvestment(uint maxWei) public grantOwner notEnded {
        require(maxWei >= minSale);
        maxUnidentifiedInvestment = maxWei;
    }

    function updateMinSale(uint weiAmount) public grantOwner {
        minSale = weiAmount;
    }

    /**
     * Allow crowdsale participant to get refunded
     */
    function refundContribution(address participant) internal {
        require(state == CrowdsaleState.Ended);
        require(weiSpent[participant] > 0);
        require(crowdsaleEndedSuccessfully == false);
        
        uint refundableAmount = weiSpent[participant];
        weiSpent[participant] = 0;

        msg.sender.transfer(refundableAmount);
    }

    function refund(address participant) public grantOwner {
        refundContribution(participant);
    }

    function burnLeftoverTokens(uint8 percentage) public grantOwner {
        require(state == CrowdsaleState.Ended);
        require(percentage <= 100 && percentage > 0);

        uint tokensRemaining = HARD_CAP - tokensExchanged;

        if (tokensRemaining > 0) {
            uint amount = percentage / 100 * tokensRemaining;
            token.burn(amount);
        }
    }

    function updateExchangeRate(CrowdsaleStage _stage, uint tokens, uint price) public grantOwner {
        require(tokens > 0 && price > 0);

        exchangeRates[uint8(_stage)] = ExchangeRate({
            tokens: tokens,
            price: price
        });
    }

    /**
     * Defines number of tokens and associated price in exchange
     */
    function exchangeRate()
        internal view
        returns (uint batchSize, uint batchPrice)
    {
        ExchangeRate storage rate = exchangeRates[uint8(stage)];

        require(rate.tokens > 0 && rate.price > 0);

        batchSize = rate.tokens;
        batchPrice = rate.price;
    }

    function getStageCap() internal view returns (uint) {
        if (stage == CrowdsaleStage.TokenReservation || stage == CrowdsaleStage.ClosedPresale) {
            return MIN_CAP;
        } else if (stage == CrowdsaleStage.PublicPresale) {
            return SOFT_CAP;
        } else if (stage == CrowdsaleStage.Sale) {
            return POWER_CAP;
        } else if (stage == CrowdsaleStage.LastChance) {
            return HARD_CAP;
        }

        assert(false);
    }

    function enterNextStage() internal {
        if (stage == CrowdsaleStage.TokenReservation || stage == CrowdsaleStage.ClosedPresale) {
            stage = CrowdsaleStage.PublicPresale;
        } else if (stage == CrowdsaleStage.PublicPresale) {
            stage = CrowdsaleStage.Sale;
        } else if (stage == CrowdsaleStage.Sale) {
            stage = CrowdsaleStage.LastChance;
        }
    }

    function trySuspend(address sender, uint weiSent) internal returns (bool) {
        uint senderWeiSpent = weiSpent[sender].add(weiSent);

        if (senderWeiSpent > maxUnidentifiedInvestment && ! identifiedAddresses[sender]) {
            suspended[sender] = suspended[sender].add(weiSent);
            return true;
        }

        return false;
    }

    modifier notEnded {
        require(state != CrowdsaleState.Ended);
        _;
    }
}