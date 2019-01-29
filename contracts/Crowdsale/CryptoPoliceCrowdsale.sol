pragma solidity ^0.5.3;
pragma experimental ABIEncoderV2;

import "./CrowdsaleToken.sol";
import "../Utils/Math.sol";
import "../Utils/Ownable.sol";
import "../Utils/AddressUtils.sol";

contract CryptoPoliceCrowdsale is Ownable {
    using MathUtils for uint;
    using AddressUtils for address;

    enum CrowdsaleState {
        Pending, Started, Ended, Paused, SoldOut
    }

    struct ExchangeRate {
        uint tokens;
        uint price;
    }

    struct Payment {
        uint weiAmount;
        ExchangeRate rate;
        bytes32 externalPaymentReference;
    }

    struct Participant {
        bool banned;
        bool kycCompliant;

        uint exchangedWeiAmount;
        uint exchangedVirtualWeiAmount;

        uint suspendedWeiAmount;

        Payment[] suspendedInternalPayments;
        Payment[] suspendedExternalPayments;
    }

    /**
     * Event for signaling that there are no more tokens to be sold
     */
    event TokensSoldOut();

    /**
     * Signal that payment cannot be processed
     */
    event PaymentSuspended(address participant, Payment payment);

    /**
     * Signal that payment was successfully processed and tokens are exchanged
     */
    event PaymentProcessed(address participant, Payment payment, uint tokens, uint paymentReminder);

    /**
     * Total number of tokens assigned for crowdsale
     */
    uint public constant HARDCAP = 510000000e18;

    /**
     * Address that can issue administrative actions
     */
    address public admin;

    /**
     * Amount of tokens exchanged in this crowdsale
     */
    uint public exchangedTokenCount;

    /**
     * Minimum number of Wei that can be exchanged for tokens in single transaction
     */
    uint public minimumProcessableWeiAmount = 0.01 ether;
    
    /**
     * Unprocessed amount of Wei that has been sent to this contract
     * thus not yet part of crowdsale funds
     */
    uint public unprocessedBalance = 0;

    /**
     * Token that will be sold
     */
    CrowdsaleToken public token;
    
    /**
     * State in which the crowdsale is in
     */
    CrowdsaleState public state = CrowdsaleState.Pending;

    /**
     * Current exchange rate
     */
    ExchangeRate public exchangeRate;
    
    /**
     * Whether or not crowdsale is considered successful after its end 
     */
    bool public crowdsaleSucceeded = false;

    /**
     * Number of Wei that can be paid without carrying out KYC process
     * throughout entire crowdsale period
     */
    uint public cumulativePaymentLimitOfNonKycCompliantParticipant = 1.45 ether;

    /**
     * Crowdsale participants
     */
    mapping(address => Participant) public participants;

    /**
     * Whether thransaction must be reverted on not when participant
     * does not comply with KYC rules
     */
    bool public suspendNonKycCompliantParticipantPayment = false;

    /**
     * Process payment when crowdsale is started by exchanging payment to tokens.
     * Returns all processed and unprocessed payments back to the participant
     * when crowdsale has ended and did not succeeded along with payment
     * that was sent in this transaction (manually issued refund by participant).
     */
    function () external payable {
        if (state == CrowdsaleState.Ended) {
            msg.sender.transfer(msg.value);
            chargeback(msg.sender);
        } else {
            require(state == CrowdsaleState.Started, "Crowdsale currently inactive");
            processPayment(msg.sender, msg.value, exchangeRate, "");
        }
    }

    function processPayment(address payable participantAddress,
        uint payment, ExchangeRate memory rate, bytes32 externalPaymentReference)
    internal whenValidExchangeRate(rate.tokens, rate.price) {
        require(payment >= minimumProcessableWeiAmount,
            "Payment must be greather than or equal to the sale minimum");

        Participant storage participant = participants[participantAddress];

        require(participant.banned == false,
            "Cannot process payment because participant is banned");

        bool isInternalPayment = externalPaymentReference == "";
        (uint processableTokenAmount, uint processableWeiAmount) = calculateExchangeVariables(payment, rate);

        if (isPaymentSuspendableBecauseNonKycCompliantParticipant(participant, processableWeiAmount)) {
            // revert transaction if suspending payments are not allowed globally
            require(suspendNonKycCompliantParticipantPayment,
                "Participant must carry out KYC");

            Payment[] storage suspendedPayments = isInternalPayment
                ? participant.suspendedInternalPayments
                : participant.suspendedExternalPayments;

            // suspend payment by tracking payment amount and current exchange rate
            suspendedPayments.push(Payment({
                weiAmount: payment,
                rate: ExchangeRate({
                    tokens: rate.tokens,
                    price: rate.price
                }),
                externalPaymentReference: externalPaymentReference
            }));

            emit PaymentSuspended(participantAddress, Payment({
                weiAmount: payment,
                rate: ExchangeRate({
                    tokens: rate.tokens,
                    price: rate.price
                }),
                externalPaymentReference: externalPaymentReference
            }));
            
            if (isInternalPayment) {
                // suspended payments are not part of moveable crowdsale funds
                unprocessedBalance = unprocessedBalance.add(payment);
                participant.suspendedWeiAmount = participant.suspendedWeiAmount
                    .add(payment);
            }

            // stop processing payment because it has been suspended
            return;
        }

        // transfer calculated token amount
        require(token.transfer(participantAddress, processableTokenAmount),
            "Failed to transfer tokens to participant");

        // increase globaly exchanged token amount
        exchangedTokenCount += processableTokenAmount;

        uint paymentReminder = payment - processableWeiAmount;

        if (isInternalPayment) {
            // return payment reminder
            participantAddress.transfer(paymentReminder);
            participant.exchangedWeiAmount += processableWeiAmount;
        } else {
            participant.exchangedVirtualWeiAmount += processableWeiAmount;
        }

        // when there are no round number of exchangeable token portions left
        if ((HARDCAP - exchangedTokenCount) < rate.tokens) {
            state = CrowdsaleState.SoldOut;
            emit TokensSoldOut();
        }

        emit PaymentProcessed(participantAddress, Payment({
            weiAmount: payment,
            rate: ExchangeRate({
                tokens: rate.tokens,
                price: rate.price
            }),
            externalPaymentReference: externalPaymentReference
        }), processableTokenAmount, paymentReminder);
    }

    function calculateExchangeVariables(uint payment, ExchangeRate memory rate)
    internal view returns (uint processableTokenAmount, uint processableWeiAmount) {
        // how many round number of exchangeable token portions are left
        uint availablePortions = (HARDCAP - exchangedTokenCount) / rate.tokens;
        uint requestedPortions = payment / rate.price;
        uint processablePortions = requestedPortions > availablePortions
            ? availablePortions : requestedPortions;
        processableTokenAmount = processablePortions * rate.tokens;
        processableWeiAmount = processablePortions * rate.price;
    }

    function isPaymentSuspendableBecauseNonKycCompliantParticipant(Participant storage participant, uint payment)
    internal view returns (bool) {
        if ( ! participant.kycCompliant) {
            // calculate how much participant has spent so far
            uint cumulativeExchangeAmount = participant.exchangedWeiAmount
                .add(payment).add(participant.exchangedVirtualWeiAmount);
            // check if participant has spent more than limit allows
            return cumulativeExchangeAmount > cumulativePaymentLimitOfNonKycCompliantParticipant;
        }

        return false;
    }

    /**
     * Process other type of payment methods
     */
    function processExternalPayment(address payable participant,
        uint payment, ExchangeRate memory rate, bytes32 paymentReference)
    public whenOwnerOrAdmin whenValidAddress(participant) {
        require(paymentReference.length > 0, "External payment must have payment reference");
        processPayment(participant, payment, rate, paymentReference);
    }

    function setSuspendNonKycCompliantParticipantPayment(bool suspend) public grantOwner {
        suspendNonKycCompliantParticipantPayment = suspend;
    }

    function setParticipantIsNotKycCompliant(address participantAddress)
    public whenOwnerOrAdmin {
        participants[participantAddress].kycCompliant = false;
    }

    function setParticipantIsKycCompliant(address payable participantAddress)
    public whenOwnerOrAdmin {
        Participant storage participant = participants[participantAddress];
        participant.kycCompliant = true;

        if (participant.suspendedInternalPayments.length > 0) {
            for (uint pidx = 0; pidx < participant.suspendedInternalPayments.length; pidx++) {
                Payment storage payment = participant.suspendedInternalPayments[pidx];
                processPayment(
                    participantAddress,
                    payment.weiAmount,
                    payment.rate,
                    payment.externalPaymentReference);
            }
            unprocessedBalance -= participant.suspendedWeiAmount;
            delete participant.suspendedInternalPayments;
            participant.suspendedWeiAmount = 0;
        }

        if (participant.suspendedExternalPayments.length > 0) {
            for (uint pidx = 0; pidx < participant.suspendedExternalPayments.length; pidx++) {
                Payment storage payment = participant.suspendedExternalPayments[pidx];
                processPayment(
                    participantAddress,
                    payment.weiAmount,
                    payment.rate,
                    payment.externalPaymentReference);
            }
            delete participant.suspendedExternalPayments;
        }
    }

    function setCumulativePaymentLimitOfNonKycCompliantParticipant(uint weiLimit)
    public whenOwnerOrAdmin {
        cumulativePaymentLimitOfNonKycCompliantParticipant = weiLimit;
    }

    function setMinimumProcessableWeiAmount(uint treshold)
    public whenOwnerOrAdmin {
        require(minimumProcessableWeiAmount >= exchangeRate.price,
            "Minimum sale price cannot be less than price of tokens");
        minimumProcessableWeiAmount = treshold;
    }

    function setExchangeRate(uint tokens, uint price)
    public whenOwnerOrAdmin whenValidExchangeRate(tokens, price) {
        exchangeRate = ExchangeRate({
            tokens: tokens,
            price: price
        });
    }

    function setAdmin(address adminAddress)
    public grantOwner whenValidAddress(adminAddress) {
        admin = adminAddress;
    }

    function ban(address participant) public whenOwnerOrAdmin {
        participants[participant].banned = true;
    }

    function unban(address participant) public whenOwnerOrAdmin {
        participants[participant].banned = false;
    }

    /**
     * Return all processed and unprocessed payments back to the participant
     * when crowdsale has ended and did not succeeded.
     */
    function refund(address payable participant) public whenOwnerOrAdmin {
        chargeback(participant);
    }

    /**
     * Return suspended payments to the participant in any stage of the crowdsale.
     * Primary use case is when it is not possible to carry out the KYC process
     * and suspended funds must be returned to the participant.
     */
    function refundSuspended(address payable participant) public whenOwnerOrAdmin {
        chargebackInternalPayments(participant, false, true);
        chargebackExternalPayments(participant, false, true);
    }

    /**
     * Command for owner to start crowdsale
     */
    function startCrowdsale(address crowdsaleToken, address adminAddress) public grantOwner {
        require(state == CrowdsaleState.Pending);
        setAdmin(adminAddress);
        token = CrowdsaleToken(crowdsaleToken);
        require(token.balanceOf(address(this)) == HARDCAP);
        state = CrowdsaleState.Started;
    }

    function pauseCrowdsale() public whenOwnerOrAdmin {
        require(state == CrowdsaleState.Started);
        state = CrowdsaleState.Paused;
    }

    function unPauseCrowdsale() public whenOwnerOrAdmin {
        require(state == CrowdsaleState.Paused);
        state = CrowdsaleState.Started;
    }

    /**
     * Command for owner to end crowdsale
     */
    function endCrowdsale(bool success)
    public grantOwner whenCrowdsaleNotEnded {
        state = CrowdsaleState.Ended;
        crowdsaleSucceeded = success;

        uint balance = address(this).balance;

        if (success && balance > 0) {
            uint amount = balance.sub(unprocessedBalance);
            owner.transfer(amount);
        }
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

    /**
     * Return all processed and unprocessed payments back to the participant
     * when crowdsale has ended and did not succeeded.
     */
    function chargeback(address payable participant) internal {
        require(state == CrowdsaleState.Ended);
        require(crowdsaleSucceeded == false);
        
        chargebackInternalPayments(participant, true, true);
        chargebackExternalPayments(participant, true, true);
    }

    /**
     * Transfer processed and unprocessed payments back to the participant.
     *
     * @param participantAddress Participant's address
     * @param processed Whether or not processed payments should be included
     * @param suspended Whether or not suspended payments should be included
     */
    function chargebackInternalPayments(address payable participantAddress, bool processed, bool suspended)
    internal {
        Participant storage participant = participants[participantAddress];

        if (processed && participant.exchangedWeiAmount > 0) {
            participantAddress.transfer(participant.exchangedWeiAmount);
            participant.exchangedWeiAmount = 0;
        }

        if (suspended && participant.suspendedWeiAmount > 0) {
            participantAddress.transfer(participant.suspendedWeiAmount);
            unprocessedBalance -= participant.suspendedWeiAmount;
            participant.suspendedWeiAmount = 0;
            delete participant.suspendedInternalPayments;
        }
    }

    /**
     * Clear locally tracked values regarding extarnal payments
     *
     * @param participantAddress Participant's address
     * @param processed Whether or not processed payments should be included
     * @param suspended Whether or not suspended payments should be included
     */
    function chargebackExternalPayments(address participantAddress, bool processed, bool suspended)
    internal {
        Participant storage participant = participants[participantAddress];

        if (processed && participant.exchangedVirtualWeiAmount > 0) {
            participant.exchangedVirtualWeiAmount = 0;
        }
        
        if (suspended && participant.suspendedExternalPayments.length > 0) {
            delete participant.suspendedExternalPayments;
        }
    }

    function isAdmin() internal view returns(bool) {
        return admin.notNull() && msg.sender == admin;
    }

    modifier whenCrowdsaleNotEnded {
        require(state != CrowdsaleState.Ended, "Crowdsale ended");
        _;
    }

    modifier whenOwnerOrAdmin() {
        require(isOwner() || isAdmin(), "Address not authorized");
        _;
    }

    modifier whenValidAddress(address _address) {
        require(_address.notNull(), "Given address cannot be 0");
        _;
    }

    modifier whenValidExchangeRate(uint tokens, uint price) {
        require(tokens > 0, "Exchange rate token amount must be greather than 0");
        require(price > 0, "Exchange rate token price must be greather than 0");
        require(minimumProcessableWeiAmount >= price,
            "Exchange rate token price cannot be greather than minimum sale price");
        _;
    }
}