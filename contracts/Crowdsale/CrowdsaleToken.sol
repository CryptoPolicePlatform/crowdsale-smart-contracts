pragma solidity ^0.4.19;

interface CrowdsaleToken {
    function transfer(address destination, uint amount) public returns (bool);
    function balanceOf(address account) public constant returns (uint);
    function burn(uint amount) public;
    function returnTokens(address _address) public returns (uint);
}