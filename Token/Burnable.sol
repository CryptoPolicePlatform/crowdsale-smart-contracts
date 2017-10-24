pragma solidity ^0.4.18;

import "./../Utils/Ownable.sol";
import "./../Utils/Math.sol";
import "./TotalSupply.sol";
import "./Balance.sol";

contract Burnable is TotalSupply, Balance, Ownable {
    using MathUtils for uint;

    event Burn(address account, uint value);

    mapping(address => bool) internal burners;

    function burn(uint amount) public grantBurner requiresSufficientBalance(msg.sender, amount)
    {
        balances[msg.sender] = balances[msg.sender].sub(amount);
        totalSupply = totalSupply.sub(amount);
        Burn(msg.sender, amount);
    }

    function grantBurn(address burner) public grantOwner {
        burners[burner] = true;
    }

    function removeBurnAccess(address burner) public grantOwner {
        burners[burner] = false;
    }

    modifier grantBurner {
        require(burners[msg.sender]);
        _;
    }
}