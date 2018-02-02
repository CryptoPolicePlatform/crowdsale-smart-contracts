pragma solidity ^0.4.19;

import "./CrowdsaleToken.sol";
import "./CrowdsaleAccessPolicy.sol";
import "./../Utils/Math.sol";

// TODO: KYC event
// TODO: Gas price and limit
// TODO: Test against common security issues
// TODO: send back tokens to owner in case of failure?
contract CryptoPoliceCrowdsale is CrowdsaleAccessPolicy {
    using MathUtils for uint;

    enum CrowdsaleState {
        Pending, Started, Ended, Paused, SoldOut
    }

    struct ExchangeRate {
        uint tokens;
        uint price;
    }

    struct Participant {
        bool identified;
        uint directWeiAmount;
        uint externalWeiAmount;
        uint suspendedDirectWeiAmount;
        uint suspendedExternalWeiAmount;
    }

    uint public constant MIN_CAP = 12500000 * 10**18;
    uint public constant SOFT_CAP = 51000000 * 10**18;
    uint public constant POWER_CAP = 204000000 * 10**18;
    uint public constant HARD_CAP = 510000000 * 10**18;

    uint public tokensExchanged;

    /**
     * Minimum number of wei that can be exchanged for tokens
     */
    uint public minSale = 0.01 ether;
    
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

    mapping(address => Participant) public participants;

    ExchangeRate[4] public exchangeRates;
    
    bool public crowdsaleEndedSuccessfully = false;

    uint public maxUnidentifiedAmount = 25 ether;

    mapping(bytes32 => string) public externalPaymentReferences;

    /**
     * Exchange tokens for Wei received
     */
    function () public payable {
        if (state == CrowdsaleState.Ended) {
            msg.sender.transfer(msg.value);
            refundContribution(msg.sender);
        } else {
            require(state == CrowdsaleState.Started);
            exchange(msg.sender, msg.value, true);
        }
    }

    function exchange(address sender, uint weiSent, bool direct) internal {
        require(weiSent >= minSale);

        uint totalWeiSpent = participants[sender].directWeiAmount.add(weiSent);
        totalWeiSpent = totalWeiSpent.add(participants[sender].externalWeiAmount);

        if (totalWeiSpent > maxUnidentifiedAmount && ! participants[sender].identified) {
            if (direct) {
                participants[sender].suspendedDirectWeiAmount = participants[sender].suspendedDirectWeiAmount.add(weiSent);
            } else {
                participants[sender].suspendedExternalWeiAmount = participants[sender].suspendedExternalWeiAmount.add(weiSent);
            }
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

        if (weiRemaining > 0 && direct) {
            sender.transfer(weiRemaining);
        }

        if (direct) {
            participants[sender].directWeiAmount = participants[sender].directWeiAmount.add(weiExchanged);
        } else {
            participants[sender].externalWeiAmount = participants[sender].externalWeiAmount.add(weiExchanged);
        }
        
        weiRaised = weiRaised + weiExchanged;

        transferTokens(sender, tokens);
    }

    function transferTokens(address recipient, uint amount) internal {
        require(token.transfer(recipient, amount));
    }

    /**
     * Intended when other currencies are received and owner has to carry out exchange
     * for those funds aligned to Wei
     */
    function proxyExchange(address beneficiary, uint weiSent, string reference, bytes32 refChecksum)
    public proxyExchangePolicy
    {
        require(beneficiary != address(0));
        require(bytes(reference).length > 0);
        require(refChecksum.length > 0);

        string storage epr = externalPaymentReferences[refChecksum];

        require(bytes(epr).length == 0);

        exchange(beneficiary, weiSent, false);
        
        externalPaymentReferences[refChecksum] = reference;
    }

    /**
     * Command for owner to start crowdsale
     */
    function startCrowdsale(address crowdsaleToken, address adminAddress) public grantOwner {
        require(state == CrowdsaleState.Pending);
        setAdmin(adminAddress);
        token = CrowdsaleToken(crowdsaleToken);
        require(token.balanceOf(address(this)) == HARD_CAP);
        state = CrowdsaleState.Started;
    }

    function pauseCrowdsale() public pauseCrowdsalePolicy {
        require(state == CrowdsaleState.Started);
        state = CrowdsaleState.Paused;
    }

    function unPauseCrowdsale() public unpauseCrowdsalePolicy {
        require(state == CrowdsaleState.Paused);
        state = CrowdsaleState.Started;
    }

    /**
     * Command for owner to end crowdsale
     */
    function endCrowdsale(bool success) public grantOwner notEnded {
        state = CrowdsaleState.Ended;
        crowdsaleEndedSuccessfully = success;

        if (success && this.balance > 0) {
            owner.transfer(this.balance); // TODO: Do not send suspended resources
        }
    }

    function markAddressIdentified(address _address) public markAddressIdentifiedPolicy notEnded {
        participants[_address].identified = true;

        if (participants[_address].suspendedDirectWeiAmount > 0) {
            exchange(_address, participants[_address].suspendedDirectWeiAmount, true);
            participants[_address].suspendedDirectWeiAmount = 0;
        }

        if (participants[_address].suspendedExternalWeiAmount > 0) {
            exchange(_address, participants[_address].suspendedExternalWeiAmount, false);
            participants[_address].suspendedExternalWeiAmount = 0;
        }
    }

    function returnSuspendedFunds(address _address) public returnSuspendedFundsPolicy {
        require(participants[_address].suspendedDirectWeiAmount > 0);

        uint amount = participants[_address].suspendedDirectWeiAmount;
        participants[_address].suspendedDirectWeiAmount = 0;
        participants[_address].suspendedExternalWeiAmount = 0;
        
        _address.transfer(amount);
    }

    function updatemaxUnidentifiedAmount(uint maxWei) public grantOwner notEnded {
        require(maxWei >= minSale);
        maxUnidentifiedAmount = maxWei;
    }

    function updateMinSale(uint weiAmount) public grantOwner {
        minSale = weiAmount;
    }

    /**
     * Allow crowdsale participant to get refunded
     */
    function refundContribution(address participant) internal {
        require(state == CrowdsaleState.Ended);
        require(crowdsaleEndedSuccessfully == false); // TODO: Handle suspended resources
        require(participants[participant].directWeiAmount > 0);
        
        uint refundableAmount = participants[participant].directWeiAmount;
        participants[participant].directWeiAmount = 0;

        participant.transfer(refundableAmount);
    }

    function refund(address participant) public grantOwner {
        refundContribution(participant);
    }

    function burnLeftoverTokens(uint8 percentage) public grantOwner {
        require(state == CrowdsaleState.Ended);
        require(percentage <= 100 && percentage > 0);

        uint balance = token.balanceOf(address(this));

        if (balance > 0) {
            uint amount = balance / (100 / percentage);
            token.burn(amount);
        }
    }

    function updateExchangeRate(uint8 idx, uint tokens, uint price) public updateExchangeRatePolicy {
        require(tokens > 0 && price > 0);
        require(idx >= 0 && idx <= 3);

        exchangeRates[idx] = ExchangeRate({
            tokens: tokens,
            price: price
        });
    }

    function getExchangeRate(uint currentGoal) internal view returns (ExchangeRate) {
        uint8 idx = capRateIndexMapping(currentGoal);

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

    function moneyBack(address _address) public notEnded moneyBackPolicy {
        require(participants[_address].directWeiAmount > 0);

        uint refundableTokenAmount = token.returnTokens(_address);
        tokensExchanged = tokensExchanged.sub(refundableTokenAmount);

        uint refundAmount = participants[_address].directWeiAmount;
        participants[_address].directWeiAmount = 0;

        _address.transfer(refundAmount);   
    }

    function getHardCap() public pure returns(uint) {
        return HARD_CAP;
    }

    function isCrowdsaleSuccessful() public view returns(bool) {
        return state == CrowdsaleState.Ended && crowdsaleEndedSuccessfully;
    }

    modifier notEnded {
        require(state != CrowdsaleState.Ended);
        _;
    }
}