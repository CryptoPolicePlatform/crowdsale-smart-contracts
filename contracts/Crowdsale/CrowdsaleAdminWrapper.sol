pragma solidity ^0.4.23;

import "../Utils/Ownable.sol";
import "./CrowdsaleAdminActions.sol";

contract CrowdsaleAdminWrapper is Ownable
{
    address public actor;
    CrowdsaleAdminActions public actions;

    function setActor(address _actor) public grantOwner {
        actor = _actor;
    }

    function setCrowdsale(address crowdsale) public grantOwner {
        actions = CrowdsaleAdminActions(crowdsale);
    }

    function proxyExchange(address beneficiary, uint payment, string description, bytes32 checksum) public grantPriviledged {
        actions.proxyExchange(beneficiary, payment, description, checksum);
    }

    function pauseCrowdsale() public grantPriviledged {
        actions.pauseCrowdsale();
    }

    function unPauseCrowdsale() public grantPriviledged {
        actions.unPauseCrowdsale();
    }

    function markParticipantIdentifiend(address participant) public grantPriviledged {
        actions.markParticipantIdentifiend(participant);
    }

    function unidentifyParticipant(address participant) public grantPriviledged {
        actions.unidentifyParticipant(participant);
    }

    function returnSuspendedPayments(address participant) public grantPriviledged {
        actions.returnSuspendedPayments(participant);
    }

    function updateUnidentifiedSaleLimit(uint limit) public grantPriviledged {
        actions.updateUnidentifiedSaleLimit(limit);
    }

    function updateMinSale(uint weiAmount) public grantPriviledged {
        actions.updateMinSale(weiAmount);
    }

    function updateExchangeRate(uint8 idx, uint tokens, uint price) public grantPriviledged {
        actions.updateExchangeRate(idx, tokens, price);
    }

    function ban(address participant) public grantPriviledged {
        actions.ban(participant);
    }

    function unBan(address participant) public grantPriviledged {
        actions.unBan(participant);
    }

    function updateRevertSuspendedPayment(bool value) public grantPriviledged {
        actions.updateRevertSuspendedPayment(value);
    }

    function updatePrices(
        uint minSale,
        uint unidentifiedSaleLimit,
        uint[] exchangeRateTokens,
        uint[] exchangeRatePrices
    )
    public grantPriviledged
    {
        require(
            exchangeRateTokens.length == exchangeRatePrices.length,
            "Exchange rate arrays must have equal element count"
        );
        require(exchangeRateTokens.length <= 4, "Up to 4 exchange rate indexes allowed");

        actions.updateMinSale(minSale);
        actions.updateUnidentifiedSaleLimit(unidentifiedSaleLimit);

        uint8 pricingIdx = 3;

        for (uint i = 0; i < exchangeRatePrices.length; i++) {
            actions.updateExchangeRate(pricingIdx, exchangeRateTokens[i], exchangeRatePrices[i]);
            pricingIdx--;
        }
    }

    modifier grantPriviledged {
        require(msg.sender == actor || isOwner(), "Forbidden");
        _;
    }
}