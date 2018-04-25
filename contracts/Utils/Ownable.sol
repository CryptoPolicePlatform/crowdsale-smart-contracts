pragma solidity ^0.4.23;

contract Ownable {
    address public owner;

    constructor() public {
        owner = msg.sender;
    }

    function isOwner() view public returns (bool) {
        return msg.sender == owner;
    }

    modifier grantOwner {
        require(isOwner());
        _;
    }
}