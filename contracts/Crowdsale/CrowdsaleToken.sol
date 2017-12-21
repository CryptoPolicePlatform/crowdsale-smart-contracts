pragma solidity ^0.4.18;

interface CrowdsaleToken {
    function transferFrom(address source, address destination, uint amount) public returns (bool);
    function allowance(address fromAccount, address destination) public constant returns (uint);
    function burn(uint amount) public;
}