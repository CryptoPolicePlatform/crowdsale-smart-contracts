const CryptoPoliceProxy = artifacts.require("CryptoPoliceProxy");
const CryptoPoliceAirdrop = artifacts.require("CryptoPoliceAirdrop");
const CryptoPoliceOfficerToken = artifacts.require("CryptoPoliceOfficerToken");
const Assert = require('assert');

contract('CryptoPoliceAirdrop', function(accounts) {
    it("Bulk transfer same amount", function() {
        return CryptoPoliceOfficerToken.deployed().then(function (token) {
            return CryptoPoliceProxy.deployed().then(function (proxy) {
                return token.setCrowdsaleContract(proxy.address).then(function () {
                    return CryptoPoliceAirdrop.deployed().then(function (airdrop) {
                        return token.approve(proxy.address, 4).then(function () {
                            return proxy.grantAllowanceProxyAccess(airdrop.address).then(function () {
                                var recipients = [accounts[1], accounts[2]];
                                return airdrop.bulkTransferEqualAmount(recipients, 2).then(function () {
                                    return token.balanceOf.call(recipients[0]).then(function(tokenCount) {
                                        Assert.equal(tokenCount.toString(), "2");
                                        return token.balanceOf.call(recipients[1]).then(function(tokenCount) {
                                            Assert.equal(tokenCount.toString(), "2");
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});