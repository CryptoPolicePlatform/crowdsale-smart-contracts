pragma solidity ^0.4.23;

interface CrowdsaleToken {
    function transfer(address destination, uint amount) external returns (bool);
    function balanceOf(address account) external constant returns (uint);
    function burn(uint amount) external;
}