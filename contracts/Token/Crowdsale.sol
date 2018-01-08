pragma solidity ^0.4.18;

import "./../Utils/Ownable.sol";

contract Crowdsale is Ownable {
    address public crowdsaleContract;

    function isCrowdsale() internal view returns(bool) {
        require(crowdsaleContract != address(0));
        return msg.sender == crowdsaleContract;
    }

    function addressIsCrowdsale(address _address) public view returns(bool) {
        return crowdsaleContract == _address;
    }

    function setCrowdsaleContract(address crowdsale) public grantOwner {
        require(crowdsaleContract == address(0));
        crowdsaleContract = crowdsale;
    }

    function getCrowdsaleHardCap() internal view returns(uint) {
        require(crowdsaleSet());
        return HardCap(crowdsaleContract).getHardCap();
    }
}