pragma solidity ^0.4.18;

import "./../Utils/Ownable.sol";

// TODO: Contract name
contract Crowdsale is Ownable {
    address public crowdsaleContract;

    function isCrowdsale() internal view returns(bool) {
        require(crowdsaleContract != address(0));
        return msg.sender == crowdsaleContract;
    }

    function setCrowdsaleContract(address crowdsale) public grantOwner {
        crowdsaleContract = crowdsale;
    }
}