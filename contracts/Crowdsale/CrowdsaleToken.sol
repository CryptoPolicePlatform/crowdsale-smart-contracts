pragma solidity ^0.5.2;

interface CrowdsaleToken {
    function transfer(address destination, uint amount) external returns (bool);
    function balanceOf(address account) external view returns (uint);
    function burn(uint amount) external;
}