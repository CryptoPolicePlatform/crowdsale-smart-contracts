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

    mapping(address => uint) public reservedTokens;

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
        uint goal = getCurrentGoal();

        while (true) {
            ExchangeRate memory rate = getExchangeRate(goal);
            
            uint batches = weiRemaining / rate.price;
            uint tokenAmount = batches.mul(rate.tokens);
            
            if (tokenAmount > goal) {
                // we have to exchange remainder for current rate
                uint remainder = goal - tokensExchanged;

                // how many tokens can be exchanged
                batches = remainder / rate.tokens;

                if (batches > 0) {
                    tokens = tokens + batches * rate.tokens;
                    weiExchanged = batches * rate.price;
                    weiRemaining = weiRemaining - weiExchanged;
                    tokensExchanged = tokensExchanged + tokens;
                }

                goal = getNextGoal(goal);

                if (goal == HARD_CAP) {
                    state = CrowdsaleState.SoldOut;
                    break;
                }
                
                continue;
            }

            tokens = tokens + tokenAmount;
            weiExchanged = batches * rate.price;
            weiRemaining = weiRemaining - weiExchanged;
            tokensExchanged = tokensExchanged + tokens;
            
            if (goal == HARD_CAP) {
                state = CrowdsaleState.SoldOut;
            }

            break;
        }

        if (weiRemaining > 0) {
            sender.transfer(weiRemaining);
        }

        weiSpent[sender] = weiSpent[sender] + weiExchanged;
        weiRaised = weiRaised + weiExchanged;

        if (stage == CrowdsaleStage.TokenReservation) {
            reservedTokens[sender] = reservedTokens[sender].add(tokens);
        } else {
            transferTokens(sender, tokens);
        }
    }

    function transferTokens(address recipient, uint amount) internal {
        require(token.transferFrom(owner, recipient, amount));
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

    function transferReservedTokens(address recipient) public grantOwner {
        uint amount = reservedTokens[recipient];

        require(amount > 0);

        reservedTokens[recipient] = 0;
        
        transferTokens(recipient, amount);
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

    function updateExchangeRate(uint8 idx, uint tokens, uint price) public grantOwner {
        require(tokens > 0 && price > 0);
        require(idx >= 0 && idx <= 3);

        exchangeRates[idx] = ExchangeRate({
            tokens: tokens,
            price: price
        });
    }

    function getExchangeRate(uint currentGoal) internal view returns (ExchangeRate) {
        uint8 idxC = capRateIndexMapping(currentGoal);
        uint8 idxS = stageRateIndexMapping();
        uint8 idx = idxC > idxS ? idxC : idxS;

        ExchangeRate storage rate = exchangeRates[idx];

        require(rate.tokens > 0 && rate.price > 0);

        return rate;
    }

    function getCurrentGoal() internal view returns (uint) {
        if (tokensExchanged < MIN_CAP) {
            return MIN_CAP;
        } else if (tokensExchanged < SOFT_CAP) {
            return SOFT_CAP;
        } else if (tokensExchanged < POWER_CAP) {
            return POWER_CAP;
        } else if (tokensExchanged < HARD_CAP) {
            return HARD_CAP;
        }

        assert(false);
    }

    function getNextGoal(uint currentGoal) internal pure returns (uint) {
        if (currentGoal == MIN_CAP) {
            return SOFT_CAP;
        } else if (currentGoal == SOFT_CAP) {
            return POWER_CAP;
        } else if (currentGoal == POWER_CAP) {
            return HARD_CAP;
        }
        
        assert(false);
    }

    function stageRateIndexMapping() internal view returns (uint8) {
        if (stage == CrowdsaleStage.TokenReservation || stage == CrowdsaleStage.ClosedPresale) {
            return 0;
        } else if (stage == CrowdsaleStage.PublicPresale) {
            return 1;
        } else if (stage == CrowdsaleStage.Sale) {
            return 2;
        } else if (stage == CrowdsaleStage.LastChance) {
            return 3;
        }

        assert(false);
    }

    function capRateIndexMapping(uint currentGoal) internal pure returns (uint8) {
        if (currentGoal <= MIN_CAP) {
            return 0;
        } else if (currentGoal <= SOFT_CAP) {
            return 1;
        } else if (currentGoal <= POWER_CAP) {
            return 2;
        } else if (currentGoal > POWER_CAP && currentGoal < HARD_CAP) {
            return 3;
        }

        // at this point hard cap is reached
        assert(false);
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