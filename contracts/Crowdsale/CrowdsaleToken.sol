pragma solidity ^0.5.3;

interface CrowdsaleToken {
    function transfer(address destination, uint amount) external returns (bool);
    function balanceOf(address account) external view returns (uint);
    function burn(uint amount) external;
}