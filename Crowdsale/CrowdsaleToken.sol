pragma solidity ^0.4.19;

interface CrowdsaleToken {
    function transfer(address destination, uint amount) public returns (bool);
    function totalSupply() public constant returns (uint);
    function balanceOf(address account) public constant returns (uint);
    function burn(uint amount) public;
}