pragma solidity ^0.4.18;

contract Ownable {
    address public owner;

    function Ownable() public {
        owner = msg.sender;
    }

    modifier owned {
        require(msg.sender == owner);
        _;
    }
}