pragma solidity ^0.4.19;

import "./CrowdsaleToken.sol";
import "./../Utils/Math.sol";
import "../Utils/Ownable.sol";

// TODO: Test fluctuating undefined payment limit
// TODO: Test refund of suspended amount
// TODO: External refund tests
// TODO: KYC event?
// TODO: Gas price and limit?
// TODO: Test against common security issues
contract CryptoPoliceCrowdsale is Ownable {
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
        uint processedDirectWeiAmount;
        uint processedExternalWeiAmount;
        uint suspendedDirectWeiAmount;
        uint suspendedExternalWeiAmount;
    }

    event ProcessedPaymentReturn(address participant, uint amount, bool direct);
    event SuspendedPaymentReturn(address participant, uint amount, bool direct);
    event PaymentSuspended(address participant, uint amount, bool direct);

    uint public constant MIN_CAP = 12500000 * 10**18;
    uint public constant SOFT_CAP = 51000000 * 10**18;
    uint public constant POWER_CAP = 204000000 * 10**18;
    uint public constant HARD_CAP = 510000000 * 10**18;

    address public admin;

    /**
     * Amount of tokens sold in this crowdsale
     */
    uint public tokensSold;

    /**
     * Minimum number of wei that can be exchanged for tokens
     */
    uint public minSale = 0.01 ether;
    
    /**
     * Amount of direct Wei paid to contract that are not yet processed
     */
    uint public suspendedPayments = 0;

    /**
     * Token that will be sold
     */
    CrowdsaleToken public token;
    
    /**
     * State in which the crowdsale is in
     */
    CrowdsaleState public state = CrowdsaleState.Pending;

    /**
     * List of exchange rates for each goal (cap)
     */
    ExchangeRate[4] public exchangeRates;
    
    bool public crowdsaleEndedSuccessfully = false;

    uint public unidentifiedSaleLimit = 1 ether;

    mapping(address => Participant) public participants;
    mapping(bytes32 => bool) public externalPaymentExistance;
    mapping(address => string[]) public externalPaymentReferences;

    /**
     * 1) Process payment when crowdsale started by sending tokens in return
     * 2) Issue a refund when crowdsale ended unsuccessfully 
     */
    function () public payable {
        if (state == CrowdsaleState.Ended) {
            msg.sender.transfer(msg.value);
            refundParticipant(msg.sender);
        } else {
            require(state == CrowdsaleState.Started);
            processPayment(msg.sender, msg.value, true);
        }
    }

    function exchangeCalculator(uint salePosition, uint _paymentReminder, uint _processedTokenCount)
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
            return exchangeCalculator(currentGoal, _paymentReminder, _processedTokenCount);
        }

        uint requestedPortions = _paymentReminder / currentExchangeRate.price;
        uint portions = requestedPortions > availablePortions ? availablePortions : requestedPortions;
        _processedTokenCount = _processedTokenCount + portions * currentExchangeRate.tokens;
        _paymentReminder = _paymentReminder - portions * currentExchangeRate.price;
        salePosition = salePosition + _processedTokenCount;

        if (_paymentReminder < currentExchangeRate.price) {
            return (_paymentReminder, _processedTokenCount, false);
        }
        
        return exchangeCalculator(salePosition, _paymentReminder, _processedTokenCount);
    }

    function processPayment(address participant, uint payment, bool directPayment) internal {
        require(payment >= minSale);

        var (paymentReminder, processedTokenCount, soldOut) = exchangeCalculator(tokensSold, payment, 0);

        uint spent = payment - paymentReminder;

        if (participants[participant].identified == false) {
            uint spendings = participants[participant].processedDirectWeiAmount
                .add(participants[participant].processedExternalWeiAmount).add(spent);

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

                PaymentSuspended(participant, payment, directPayment);

                return;
            }
        }

        if (paymentReminder > 0) {
            if (directPayment) {
                participant.transfer(paymentReminder);
            } else {
                ProcessedPaymentReturn(participant, paymentReminder, false);
            }
        }

        if (directPayment) {
            participants[participant].processedDirectWeiAmount = participants[participant].processedDirectWeiAmount.add(spent);
        } else {
            participants[participant].processedExternalWeiAmount = participants[participant].processedExternalWeiAmount.add(spent);
        }

        require(token.transfer(participant, processedTokenCount));
        
        if (soldOut) {
            state = CrowdsaleState.SoldOut;
        }

        tokensSold = tokensSold + processedTokenCount;
    }

    /**
     * Intended when other currencies are received and owner has to carry out exchange
     * for those payments aligned to Wei
     */
    function proxyExchange(address beneficiary, uint payment, string reference, bytes32 refChecksum)
    public grantOwnerOrAdmin
    {
        require(beneficiary != address(0));
        require(bytes(reference).length > 0);
        require(refChecksum.length > 0);
        require(externalPaymentExistance[refChecksum] == false);

        processPayment(beneficiary, payment, false);
        
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

    function pauseCrowdsale() public grantOwnerOrAdmin {
        require(state == CrowdsaleState.Started);
        state = CrowdsaleState.Paused;
    }

    function unPauseCrowdsale() public grantOwnerOrAdmin {
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

    function markParticipantIdentifiend(address participant) public grantOwnerOrAdmin notEnded {
        participants[participant].identified = true;

        if (participants[participant].suspendedDirectWeiAmount > 0) {
            processPayment(participant, participants[participant].suspendedDirectWeiAmount, true);
            suspendedPayments = suspendedPayments.sub(participants[participant].suspendedDirectWeiAmount);
            participants[participant].suspendedDirectWeiAmount = 0;
        }

        if (participants[participant].suspendedExternalWeiAmount > 0) {
            processPayment(participant, participants[participant].suspendedExternalWeiAmount, false);
            participants[participant].suspendedExternalWeiAmount = 0;
        }
    }

    function unidentifyParticipant(address participant, bool _moneyback) public grantOwnerOrAdmin notEnded {
        if (_moneyback) {
            moneyBack(participant);
        }
        participants[participant].identified = false;
    }

    function returnSuspendedPayments(address participant) public grantOwnerOrAdmin {
        returnDirectPayments(participant, false, true);
        returnExternalPayments(participant, false, true);
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
        
        returnDirectPayments(participant, true, true);
        returnExternalPayments(participant, true, true);
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

    function updateExchangeRate(uint8 idx, uint tokens, uint price) public grantOwnerOrAdmin {
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

        assert(false);
    }

    function moneyBack(address participant) public notEnded grantOwnerOrAdmin {
        uint refundedTokenCount = token.returnTokens(participant);
        tokensSold = tokensSold.sub(refundedTokenCount);

        returnDirectPayments(participant, true, true);
        returnExternalPayments(participant, true, true);
    }

    function returnDirectPayments(address participant, bool processed, bool suspended) internal {
        if (processed && participants[participant].processedDirectWeiAmount > 0) {
            ProcessedPaymentReturn(participant, participants[participant].processedDirectWeiAmount, true);
            participant.transfer(participants[participant].processedDirectWeiAmount);
            participants[participant].processedDirectWeiAmount = 0;
        }

        if (suspended && participants[participant].suspendedDirectWeiAmount > 0) {
            SuspendedPaymentReturn(participant, participants[participant].suspendedDirectWeiAmount, true);
            participant.transfer(participants[participant].suspendedDirectWeiAmount);
            participants[participant].suspendedDirectWeiAmount = 0;
        }
    }

    function returnExternalPayments(address participant, bool processed, bool suspended) internal {
        if (processed && participants[participant].processedExternalWeiAmount > 0) {
            ProcessedPaymentReturn(participant, participants[participant].processedExternalWeiAmount, false);
            participants[participant].processedExternalWeiAmount = 0;
        }
        
        if (suspended && participants[participant].suspendedExternalWeiAmount > 0) {
            SuspendedPaymentReturn(participant, participants[participant].suspendedExternalWeiAmount, false);
            participants[participant].suspendedExternalWeiAmount = 0;
        }
    }

    function setAdmin(address adminAddress) public grantOwner {
        admin = adminAddress;
        require(isAdminSet());
    }

    function isAdminSet() internal view returns(bool) {
        return admin != address(0);
    }

    function isAdmin() internal view returns(bool) {
        return isAdminSet() && msg.sender == admin;
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

    modifier grantOwnerOrAdmin() {
        require(isOwner() || isAdmin());
        _;
    }
}