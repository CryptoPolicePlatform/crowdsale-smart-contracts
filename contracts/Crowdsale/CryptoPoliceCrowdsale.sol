pragma solidity ^0.5.2;

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
    }

    struct Participant {
        bool banned;
        bool kycCompliant;
        uint exchangedWeiAmount;
        Payment[] suspendedInternalPayments;
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
    event PaymentProcessed(address participant, Payment payment, uint tokens, bytes32 paymentReference);

    /**
     * Number of how many tokens are assigned for exchange
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
    uint public minimumProcessableWeiCount = 0.01 ether;
    
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
     * Process payment when crowdsale started by sending tokens in return
     * Or issue a refund when crowdsale ended unsuccessfully 
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
        uint payment, ExchangeRate memory rate, bytes32 paymentReference)
    internal {
        require(payment >= minimumProcessableWeiCount, "Payment must be greather or equal to sale minimum");

        Participant memory participant = participants[participantAddress];

        require(participant.banned == false, "Participant is banned");

        // how many round number of exchangeable token portions are left
        uint availablePortions = (HARDCAP - exchangedTokenCount) / rate.tokens;
        uint requestedPortions = payment / rate.price;
        uint processablePortions = requestedPortions > availablePortions
            ? availablePortions : requestedPortions;
        uint processedTokenAmount = processablePortions * rate.tokens;
        uint processedWeiAmount = processablePortions * rate.price;

        // calculate how much participant has spent so far
        uint cumulativeExchangeAmount = participant.exchangedWeiAmount.add(processedWeiAmount);

        if ( ! participant.kycCompliant) {
            // check if participant has spent more than limit allows
            if (cumulativeExchangeAmount > cumulativePaymentLimitOfNonKycCompliantParticipant) {
                // automatically revert transaction if payment cannot be suspended
                require(suspendNonKycCompliantParticipantPayment,
                    "Participant must carry out KYC");

                // suspend payment by tracking payment amount and current exchange rate
                participant.suspendedInternalPayments.push(Payment({
                    weiAmount: payment,
                    rate: ExchangeRate({
                        tokens: rate.tokens,
                        price: rate.price
                    })
                }));

                emit PaymentSuspended(participantAddress, Payment({
                    weiAmount: payment,
                    rate: ExchangeRate({
                        tokens: rate.tokens,
                        price: rate.price
                    })
                }));
                
                // suspended payments are not part of moveable crowdsale funds
                // track this portion of contract's balance
                unprocessedBalance = unprocessedBalance.add(payment);

                // stop processing this payment
                return;
            }
        }

        // transfer calculated token amount
        require(token.transfer(participant, processedTokenAmount),
            "Failed to transfer tokens to participant");

        // increase globaly exchanged token amount
        exchangedTokenCount += processedTokenAmount;
        participant.exchangedWeiAmount = cumulativeExchangeAmount;

        // return payment reminder
        uint paymentReminder = payment - processedWeiAmount;
        participant.transfer(paymentReminder);

        // when there are no round number of exchangeable portions left
        if (requestedPortions > availablePortions) {
            state = CrowdsaleState.SoldOut;
            emit TokensSoldOut();
        }

        emit PaymentProcessed(participantAddress, Payment({
            weiAmount: payment,
            rate: ExchangeRate({
                tokens: rate.tokens,
                price: rate.price
            }),
            tokens: processedTokenAmount,
            paymentReference: paymentReference
        }));
    }

    // /**
    //  * Intended when other currencies are received and owner has to carry out exchange
    //  * for those payments aligned to Wei
    //  */
    // function proxyExchange(address payable beneficiary, uint payment, string memory description, bytes32 checksum)
    // public grantOwnerOrAdmin whenValidAddress(beneficiary)
    // {
    //     require(description == "", "Description not specified");
    //     require(checksum.length > 0, "Checksum not specified");
    //     // make sure that payment has not been processed yet
    //     require(bytes(externalPaymentDescriptions[checksum]).length == 0, "Payment already processed");

    //     processPayment(beneficiary, payment, checksum);
        
    //     externalPaymentDescriptions[checksum] = description;
    //     participantExternalPaymentChecksums[beneficiary].push(checksum);
    // }

    /**
     * Command for owner to start crowdsale
     */
    function startCrowdsale(address crowdsaleToken, address adminAddress) public grantOwner {
        require(state == CrowdsaleState.Pending);
        setAdmin(adminAddress);
        token = CrowdsaleToken(crowdsaleToken);
        require(token.balanceOf(address(this)) == 510000000e18);
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

    // function markParticipantIdentifiend(address payable participant) public grantOwnerOrAdmin notEnded {
    //     participants[participant].identified = true;

    //     if (participants[participant].suspendedDirectWeiAmount > 0) {
    //         processPayment(participant, participants[participant].suspendedDirectWeiAmount, "");
    //         suspendedInternalPayments = suspendedInternalPayments.sub(participants[participant].suspendedDirectWeiAmount);
    //         participants[participant].suspendedDirectWeiAmount = 0;
    //     }

    //     if (participants[participant].suspendedExternalWeiAmount > 0) {
    //         bytes32[] storage checksums = participantSuspendedExternalPaymentChecksums[participant];
    //         for (uint i = 0; i < checksums.length; i++) {
    //             processPayment(participant, suspendedExternalPayments[checksums[i]], checksums[i]);
    //             suspendedExternalPayments[checksums[i]] = 0;
    //         }
    //         participants[participant].suspendedExternalWeiAmount = 0;
    //         participantSuspendedExternalPaymentChecksums[participant] = new bytes32[](0);
    //     }
    // }

    function removeParticipantKycCompliancy(address participant)
    public grantOwnerOrAdmin whenCrowdsaleNotEnded {
        participants[participant].kycCompliant = false;
    }

    function returnsuspendedInternalPayments(address payable participant) public grantOwnerOrAdmin {
        chargebackInternalPayments(participant, false, true);
        chargebackExternalPayments(participant, false, true);
    }

    function setnonKycCompliantParticipantSaleWeiLimit(uint weiLimit)
    public grantOwnerOrAdmin whenCrowdsaleNotEnded {
        nonKycCompliantParticipantSaleWeiLimit = weiLimit;
    }

    function setMinimumProcessableWeiAmount(uint treshold)
    public grantOwnerOrAdmin {
        minimumProcessableWeiAmount = treshold;
    }

    /**
     * Pay back to the crowdsale participant
     */
    function chargeback(address payable participant) internal {
        require(state == CrowdsaleState.Ended);
        require(crowdsaleSucceeded == false);
        
        chargebackInternalPayments(participant, true, true);
        chargebackExternalPayments(participant, true, true);
    }

    /**
     * Chargeback that is issued by the owner
     */
    function refund(address payable participant) public grantOwner {
        chargeback(participant);
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

    function setExchangeRate(uint tokens, uint price) public grantOwnerOrAdmin {
        require(tokens > 0 && price > 0);

        exchangeRate = ExchangeRate({
            tokens: tokens,
            price: price
        });
    }

    function ban(address participant) public grantOwnerOrAdmin {
        participants[participant].banned = true;
    }

    function unban(address participant) public grantOwnerOrAdmin {
        participants[participant].banned = false;
    }

    function setsuspendNonKycCompliantParticipantPayment(bool suspendable) public grantOwner {
        suspendNonKycCompliantParticipantPayment = suspendable;
    }

    /**
     * Transfer Wei sent to the contract directly back to the participant
     *
     * @param participant Participant
     * @param processed Whether or not processed payments should be included
     * @param suspended Whether or not suspended payments should be included
     */
    function chargebackInternalPayments(address payable participant, bool processed, bool suspended) internal {
        if (processed && participants[participant].processedDirectWeiAmount > 0) {
            participant.transfer(participants[participant].processedDirectWeiAmount);
            participants[participant].processedDirectWeiAmount = 0;
        }

        if (suspended && participants[participant].suspendedDirectWeiAmount > 0) {
            participant.transfer(participants[participant].suspendedDirectWeiAmount);
            participants[participant].suspendedDirectWeiAmount = 0;
        }
    }

    /**
     * Signal that externally made payments should be returned back to the participant
     *
     * @param participant Participant
     * @param processed Whether or not processed payments should be included
     * @param suspended Whether or not suspended payments should be included
     */
    function chargebackExternalPayments(address participant, bool processed, bool suspended) internal {
        if (processed && participants[participant].processedExternalWeiAmount > 0) {
            participants[participant].processedExternalWeiAmount = 0;
        }
        
        if (suspended && participants[participant].suspendedExternalWeiAmount > 0) {
            participants[participant].suspendedExternalWeiAmount = 0;
        }
    }

    function setAdmin(address adminAddress)
    public grantOwner whenValidAddress(adminAddress) {
        admin = adminAddress;
    }

    function isAdmin() internal view returns(bool) {
        return admin.notNull() && msg.sender == admin;
    }

    modifier whenCrowdsaleNotEnded {
        require(state != CrowdsaleState.Ended, "Crowdsale ended");
        _;
    }

    modifier grantOwnerOrAdmin() {
        require(isOwner() || isAdmin(), "Address not authorized");
        _;
    }

    modifier whenValidAddress(address _address) {
        require(_address.notNull(), "Given address cannot be 0");
        _;
    }
}