const CryptoPoliceOfficerToken = artifacts.require("CryptoPoliceOfficerToken");
const Assert = require('assert');

contract('CryptoPoliceOfficerToken', function(accounts) {
    it("Transfer tokens before crowdsale contract is set", function() {
        return CryptoPoliceOfficerToken.deployed().then(function (token) {
            return token.transfer(accounts[1], 1337).then(function() {
                return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                    Assert.equal(tokenCount.toString(), "1337");
                })
            })
        });
    })
});