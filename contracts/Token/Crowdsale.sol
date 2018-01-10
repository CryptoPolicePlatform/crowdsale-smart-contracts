pragma solidity ^0.4.19;

import "./../Utils/Ownable.sol";
import "./CrowdsaleState.sol";
import "./HardCap.sol";

contract Crowdsale is Ownable {
    address public crowdsaleContract;

    function isCrowdsale() internal view returns(bool) {
        require(crowdsaleSet());
        return msg.sender == crowdsaleContract;
    }

    function crowdsaleSet() internal view returns(bool) {
        return crowdsaleContract != address(0);
    }

    function addressIsCrowdsale(address _address) public view returns(bool) {
        return crowdsaleSet() && crowdsaleContract == _address;
    }

    function setCrowdsaleContract(address crowdsale) public grantOwner {
        require(crowdsaleContract == address(0));
        crowdsaleContract = crowdsale;
    }

    function crowdsaleSuccessful() internal view returns(bool) {
        require(crowdsaleSet());
        return CrowdsaleState(crowdsaleContract).isCrowdsaleSuccessful();
    }

    function getCrowdsaleHardCap() internal view returns(uint) {
        require(crowdsaleSet());
        return HardCap(crowdsaleContract).getHardCap();
    }
}