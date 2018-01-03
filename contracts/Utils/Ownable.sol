pragma solidity ^0.4.18;

contract Ownable {
    address public owner;

    function Ownable() public {
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