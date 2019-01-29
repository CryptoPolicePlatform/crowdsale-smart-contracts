pragma solidity ^0.5.3;

interface CrowdsaleState {
    function isCrowdsaleSuccessful() external view returns(bool);
}