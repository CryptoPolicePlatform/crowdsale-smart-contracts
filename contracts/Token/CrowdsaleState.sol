pragma solidity ^0.4.23;

interface CrowdsaleState {
    function isCrowdsaleSuccessful() external view returns(bool);
}