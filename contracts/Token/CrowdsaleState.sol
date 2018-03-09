pragma solidity ^0.4.20;

interface CrowdsaleState {
    function isCrowdsaleSuccessful() external view returns(bool);
}