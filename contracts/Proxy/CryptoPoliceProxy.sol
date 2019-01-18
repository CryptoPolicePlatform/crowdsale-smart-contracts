pragma solidity ^0.5.2;

import "../Utils/Ownable.sol";
import "../Crowdsale/CrowdsaleToken.sol";
import "../Token/HardCap.sol";
import "../Token/CrowdsaleState.sol";
import "./ERC20Allowance.sol";

contract CryptoPoliceProxy is Ownable
{
    address public token;
    address public crowdsale;
    mapping(address => bool) public allowanceProxyAccess;

    constructor(address _token) public {
        token = _token;
    }

    function grantAllowanceProxyAccess(address allowanceOwner) grantOwner public {
        allowanceProxyAccess[allowanceOwner] = true;
    }

    function denyAllowanceProxyAccess(address allowanceOwner) grantOwner public {
        allowanceProxyAccess[allowanceOwner] = false;
    }

    function transferAllowance(address destination, uint amount) public returns (bool) {
        require(allowanceProxyAccess[msg.sender], "Sender must have allowance proxy access");
        return ERC20Allowance(token).transferFrom(owner, destination, amount);
    }

    function setCrowdsale(address _crowdsale) grantOwner public {
        crowdsale = _crowdsale;
    }

    function transfer(address destination, uint amount) grantCrowdsale public returns (bool)
    {
        return CrowdsaleToken(token).transfer(destination, amount);
    }

    function balanceOf(address account) grantCrowdsale public view returns (uint)
    {
        if (account == crowdsale) {
            return CrowdsaleToken(token).balanceOf(address(this));
        } else {
            return CrowdsaleToken(token).balanceOf(account);
        }
    }

    function burn(uint amount) grantCrowdsale public
    {
        CrowdsaleToken(token).burn(amount);
    }

    modifier grantCrowdsale {
        require(crowdsale != address(0), "Crowdsale not set");
        require(msg.sender == crowdsale, "Sender must be crowdsale");
        _;
    }

    function getHardCap() public pure returns(uint)
    {
        return 510000000e18;
    }

    function isCrowdsaleSuccessful() public view returns(bool)
    {
        return CrowdsaleState(crowdsale).isCrowdsaleSuccessful();
    }

}