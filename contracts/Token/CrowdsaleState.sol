pragma solidity ^0.4.18;

interface CrowdsaleState {
    function isCrowdsaleSuccessful() public view returns(bool);
}