pragma solidity ^0.4.23;

interface ERC20Allowance
{
    function transferFrom(address source, address destination, uint amount) external returns (bool);
}