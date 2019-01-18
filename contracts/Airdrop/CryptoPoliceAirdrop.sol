pragma solidity ^0.5.2;

import "../Utils/Ownable.sol";

interface Proxy
{
    function transferAllowance(address destination, uint amount) external returns (bool);
}

contract CryptoPoliceAirdrop is Ownable
{
    address public proxy;

    constructor(address _proxy) public {
        proxy = _proxy;
    }

    function bulkTransferEqualAmount(address[] memory recipients, uint amount) grantOwner public {
        for (uint i = 0; i < recipients.length; i++) {
            Proxy(proxy).transferAllowance(recipients[i], amount);
        }
    }
}