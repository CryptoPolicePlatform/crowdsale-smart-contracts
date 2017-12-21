const startCrowdsale = require('./../helpers/startCrowdsale');
const CryptoPoliceCrowdsale = artifacts.require("CryptoPoliceCrowdsale");
const CryptoPoliceOfficerToken = artifacts.require("CryptoPoliceOfficerToken");
const Assert = require('assert');

// BE AVARE THAT TESTS DEPEND ON EACH OTHER!!
// Tests before can set state for next test execution
// Execution order and state change should be kept in mind
contract('CryptoPoliceCrowdsale', function(accounts) {
    describe("Before crowdsale started", function () {
        it("Payments will not get accepted", function () {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return crowdsale.send(web3.toWei(1, "ether")).then(function() {
                    Assert.fail("Managed to send ether successfully");
                }).catch(function(error) {
                    Assert.ok(error.message.includes('revert'));
                })
            })
        });
        it("Admin can start crowdsale", startCrowdsale);
    });
    describe("After crowdsale started", function () {
        it("Payments will not get accepted before exchange rate is set", function () {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return crowdsale.send(web3.toWei(0.01, "ether")).then(function() {
                    Assert.fail("Managed to send ether successfully");
                }).catch(function(error) {
                    Assert.ok(error.message.includes('revert'));
                })
            })
        });
        it("Admin can update exchange rate", function() {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return crowdsale.updateExchangeRate(0, 1, 1).catch(function(error) {
                    Assert.ok(false, error.message);
                })
            })
        });
        it("Funds can be transfered", function() {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                var value = web3.toWei(0.01, "ether");
                var balanceBefore = web3.eth.getBalance(accounts[1]);
                const gasPrice = 10000000000;
                return crowdsale.sendTransaction({
                    from: accounts[1],
                    value: value,
                    gasPrice: gasPrice
                }).then(function(tx) {
                    var balanceAfter = web3.eth.getBalance(accounts[1]);
                    var calculatedBalanceAfter = balanceBefore.minus(value).minus(gasPrice * tx.receipt.gasUsed);
                    Assert.ok(balanceAfter.equals(calculatedBalanceAfter), "Balance mismatch after ether sent");
                }).catch(function(error) {
                    Assert.ok(false, error.message);
                });
            })
        });
    });
});