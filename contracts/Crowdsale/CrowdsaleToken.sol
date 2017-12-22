pragma solidity ^0.4.18;

interface CrowdsaleToken {
    function transfer(address destination, uint amount) public returns (bool);
    function balanceOf(address account) public constant returns (uint);
    function burn(uint amount) public;
}