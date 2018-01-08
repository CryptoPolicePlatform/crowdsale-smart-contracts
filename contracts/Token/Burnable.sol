pragma solidity ^0.4.18;

import "./../Utils/Ownable.sol";
import "./../Utils/Math.sol";
import "./TotalSupply.sol";
import "./Balance.sol";
import "./Crowdsale.sol";

contract Burnable is TotalSupply, Balance, Ownable, Crowdsale {
    using MathUtils for uint;

    event Burn(address account, uint value);

    function burn(uint amount) public grantBurner hasSufficientBalance(msg.sender, amount) {
        balances[msg.sender] = balances[msg.sender].sub(amount);
        totalSupply = totalSupply.sub(amount);
        Burn(msg.sender, amount);
    }

    modifier grantBurner {
        require(isCrowdsale());
        _;
    }
}