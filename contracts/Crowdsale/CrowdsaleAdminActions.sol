pragma solidity ^0.5.3;

interface CrowdsaleAdminActions {
    function proxyExchange(address beneficiary, uint payment, string calldata description, bytes32 checksum) external;
    function pauseCrowdsale() external;
    function unPauseCrowdsale() external;
    function markParticipantIdentifiend(address participant) external;
    function unidentifyParticipant(address participant) external;
    function returnSuspendedPayments(address participant) external;
    function updateUnidentifiedSaleLimit(uint limit) external;
    function updateMinSale(uint weiAmount) external;
    function updateExchangeRate(uint8 idx, uint tokens, uint price) external;
    function ban(address participant) external;
    function unBan(address participant) external;
    function updateRevertSuspendedPayment(bool value) external;
}