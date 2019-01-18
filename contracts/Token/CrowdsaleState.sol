pragma solidity ^0.5.2;

interface CrowdsaleState {
    function isCrowdsaleSuccessful() external view returns(bool);
}