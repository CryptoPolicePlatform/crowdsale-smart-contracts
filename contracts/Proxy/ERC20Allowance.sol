pragma solidity ^0.5.2;

interface ERC20Allowance
{
    function transferFrom(address source, address destination, uint amount) external returns (bool);
}