pragma solidity ^0.4.19;

import "../Utils/Ownable.sol";

contract CrowdsaleAccessPolicy is Ownable {
    address public admin;

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

    function requireOwnerOrAdmin() internal view {
        require(isOwner() || isAdmin());
    }

    modifier pauseCrowdsalePolicy {
        requireOwnerOrAdmin();
        _;
    }

    modifier unpauseCrowdsalePolicy {
        requireOwnerOrAdmin();
        _;
    }

    modifier markAddressIdentifiedPolicy {
        requireOwnerOrAdmin();
        _;
    }

    modifier proxyExchangePolicy {
        requireOwnerOrAdmin();
        _;
    }

    modifier returnSuspendedFundsPolicy {
        requireOwnerOrAdmin();
        _;
    }

    modifier updateExchangeRatePolicy {
        requireOwnerOrAdmin();
        _;
    }

    modifier moneyBackPolicy {
        requireOwnerOrAdmin();
        _;
    }
}