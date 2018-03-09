pragma solidity ^0.4.20;

interface CrowdsaleState {
    function isCrowdsaleSuccessful() public view returns(bool);
}