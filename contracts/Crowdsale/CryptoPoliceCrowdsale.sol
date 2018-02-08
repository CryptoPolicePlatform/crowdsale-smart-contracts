pragma solidity ^0.4.19;

import "./CrowdsaleToken.sol";
import "./CrowdsaleAccessPolicy.sol";
import "./../Utils/Math.sol";

// TODO: Unidentify
// TODO: Test fluctuating undefined payment limit
// TODO: Test refund of suspended amount
// TODO: External refund tests
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

    event ExternalRefund(address participant, uint amount);

    uint public constant MIN_CAP = 12500000 * 10**18;
    uint public constant SOFT_CAP = 51000000 * 10**18;
    uint public constant POWER_CAP = 204000000 * 10**18;
    uint public constant HARD_CAP = 510000000 * 10**18;

    uint public tokensSold;

    /**
     * Minimum number of wei that can be exchanged for tokens
     */
    uint public minSale = 0.01 ether;
    
    uint public suspendedPayments = 0;

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

    uint public unidentifiedSaleLimit = 1 ether;

    mapping(bytes32 => bool) public externalPaymentExistance;
    mapping(address => string[]) public externalPaymentReferences;

    /**
     * Exchange tokens for Wei received
     */
    function () public payable {
        if (state == CrowdsaleState.Ended) {
            msg.sender.transfer(msg.value);
            refundParticipant(msg.sender);
        } else {
            require(state == CrowdsaleState.Started);
            exchange(msg.sender, msg.value, true);
        }
    }

    function paymentProcessor(uint salePosition, uint _paymentReminder, uint _processedTokenCount)
    internal returns (uint paymentReminder, uint processedTokenCount, bool soldOut)
    {
        uint currentGoal = goal(salePosition);
        ExchangeRate memory currentExchangeRate = getExchangeRate(currentGoal);

        // how many round number of portions are left for exchange at current goal
        uint availablePortions = (currentGoal - salePosition) / currentExchangeRate.tokens;

        // this indicates that leftover tokens at current goal are less than we can exchange
        if (availablePortions == 0) {
            if (currentGoal == HARD_CAP) {
                return (_paymentReminder, _processedTokenCount, true);
            }
            // move sale position to current goal
            return paymentProcessor(currentGoal, _paymentReminder, _processedTokenCount);
        }

        uint requestedPortions = _paymentReminder / currentExchangeRate.price;
        uint portions = requestedPortions > availablePortions ? availablePortions : requestedPortions;
        _processedTokenCount = _processedTokenCount + portions * currentExchangeRate.tokens;
        _paymentReminder = _paymentReminder - portions * currentExchangeRate.price;
        salePosition = salePosition + _processedTokenCount;

        if (_paymentReminder < currentExchangeRate.price) {
            return (_paymentReminder, _processedTokenCount, false);
        }
        
        return paymentProcessor(salePosition, _paymentReminder, _processedTokenCount);
    }

    function exchange(address participant, uint payment, bool directPayment) internal {
        require(payment >= minSale);

        var (paymentReminder, processedTokenCount, soldOut) = paymentProcessor(tokensSold, payment, 0);

        uint spent = payment - paymentReminder;

        if (participants[participant].identified == false) {
            uint spendings = participants[participant].directWeiAmount
                .add(participants[participant].externalWeiAmount).add(spent);

            bool previouslySuspended = participants[participant].suspendedDirectWeiAmount > 0 || participants[participant].suspendedExternalWeiAmount > 0;

            // due to fluctuations of unidentified payment limit, it might not be reached
            // suspend current payment if participant currently has suspended payments or limit reached
            if (previouslySuspended || spendings > unidentifiedSaleLimit) {
                suspendedPayments = suspendedPayments + payment;

                if (directPayment) {
                    participants[participant].suspendedDirectWeiAmount = participants[participant].suspendedDirectWeiAmount.add(payment);
                } else {
                    participants[participant].suspendedExternalWeiAmount = participants[participant].suspendedExternalWeiAmount.add(payment);
                }

                return;
            }
        }

        if (paymentReminder > 0) {
            if (directPayment) {
                participant.transfer(paymentReminder);
            } else {
                ExternalRefund(participant, paymentReminder);
            }
        }

        if (directPayment) {
            participants[participant].directWeiAmount = participants[participant].directWeiAmount.add(spent);
        } else {
            participants[participant].externalWeiAmount = participants[participant].externalWeiAmount.add(spent);
        }

        transferTokens(participant, processedTokenCount);
        
        if (soldOut) {
            state = CrowdsaleState.SoldOut;
        }

        tokensSold = tokensSold + processedTokenCount;
    }

    function transferTokens(address recipient, uint amount) internal {
        require(token.transfer(recipient, amount));
    }

    /**
     * Intended when other currencies are received and owner has to carry out exchange
     * for those funds aligned to Wei
     */
    function proxyExchange(address beneficiary, uint payment, string reference, bytes32 refChecksum)
    public proxyExchangePolicy
    {
        require(beneficiary != address(0));
        require(bytes(reference).length > 0);
        require(refChecksum.length > 0);
        require(externalPaymentExistance[refChecksum] == false);

        exchange(beneficiary, payment, false);
        
        externalPaymentExistance[refChecksum] = true;
        externalPaymentReferences[beneficiary].push(reference);
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
            uint amount = this.balance.sub(suspendedPayments);
            owner.transfer(amount);
        }
    }

    function markParticipantIdentifiend(address participant) public markAddressIdentifiedPolicy notEnded {
        participants[participant].identified = true;

        if (participants[participant].suspendedDirectWeiAmount > 0) {
            exchange(participant, participants[participant].suspendedDirectWeiAmount, true);
            suspendedPayments = suspendedPayments.sub(participants[participant].suspendedDirectWeiAmount);
            participants[participant].suspendedDirectWeiAmount = 0;
        }

        if (participants[participant].suspendedExternalWeiAmount > 0) {
            exchange(participant, participants[participant].suspendedExternalWeiAmount, false);
            participants[participant].suspendedExternalWeiAmount = 0;
        }
    }

    function returnSuspendedFunds(address _address) public returnSuspendedFundsPolicy {
        require(participants[_address].suspendedDirectWeiAmount > 0);

        uint amount = participants[_address].suspendedDirectWeiAmount;
        participants[_address].suspendedDirectWeiAmount = 0;
        participants[_address].suspendedExternalWeiAmount = 0;
        
        if (amount > 0) {
            _address.transfer(amount);
            suspendedPayments = suspendedPayments.sub(amount);
        }
    }

    function updateUnidentifiedSaleLimit(uint limit) public grantOwner notEnded {
        unidentifiedSaleLimit = limit;
    }

    function updateMinSale(uint weiAmount) public grantOwner {
        minSale = weiAmount;
    }

    /**
     * Allow crowdsale participant to get refunded
     */
    function refundParticipant(address participant) internal {
        require(state == CrowdsaleState.Ended);
        require(crowdsaleEndedSuccessfully == false);
        
        directRefund(participant);
        externalRefund(participant);
    }

    function refund(address participant) public grantOwner {
        refundParticipant(participant);
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

    function getExchangeRate(uint _goal) internal view returns (ExchangeRate) {
        uint8 idx = exchangeRateIdx(_goal);

        ExchangeRate storage rate = exchangeRates[idx];

        require(rate.tokens > 0 && rate.price > 0);

        return rate;
    }

    function goal(uint salePosition) internal pure returns (uint) {
        if (salePosition < MIN_CAP) {
            return MIN_CAP;
        }
        if (salePosition < SOFT_CAP) {
            return SOFT_CAP;
        }
        if (salePosition < POWER_CAP) {
            return POWER_CAP;
        }
        if (salePosition < HARD_CAP) {
            return HARD_CAP;
        }

        assert(false);
    }

    function exchangeRateIdx(uint _goal) internal pure returns (uint8) {
        if (_goal == MIN_CAP) {
            return 0;
        }
        if (_goal == SOFT_CAP) {
            return 1;
        }
        if (_goal == POWER_CAP) {
            return 2;
        }
        if (_goal == HARD_CAP) {
            return 3;
        }

        // at this point hard cap is reached
        assert(false);
    }

    function moneyBack(address participant) public notEnded moneyBackPolicy {
        uint refundedTokenCount = token.returnTokens(participant);
        tokensSold = tokensSold.sub(refundedTokenCount);

        directRefund(participant);
        externalRefund(participant);
    }

    function directRefund(address participant) internal {
        uint amount = participants[participant].directWeiAmount;
        amount = amount.add(participants[participant].suspendedDirectWeiAmount);

        if (amount > 0) {
            participant.transfer(amount);
            participants[participant].directWeiAmount = 0;
            participants[participant].suspendedDirectWeiAmount = 0;
        }
    }

    function externalRefund(address participant) internal {
        uint amount = participants[participant].externalWeiAmount;
        amount = amount.add(participants[participant].suspendedExternalWeiAmount);

        if (amount > 0) {
            ExternalRefund(participant, amount);
            participants[participant].externalWeiAmount = 0;
            participants[participant].suspendedExternalWeiAmount = 0;
        }
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