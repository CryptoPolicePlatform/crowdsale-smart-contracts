pragma solidity ^0.4.19;

interface CrowdsaleState {
    function isCrowdsaleSuccessful() public view returns(bool);
}