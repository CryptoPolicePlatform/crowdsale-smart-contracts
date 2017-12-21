const startCrowdsale = require('./../helpers/startCrowdsale');
const CryptoPoliceCrowdsale = artifacts.require("CryptoPoliceCrowdsale");
const CryptoPoliceOfficerToken = artifacts.require("CryptoPoliceOfficerToken");
const Assert = require('assert');

// BE AVARE THAT TESTS DEPEND ON EACH OTHER!!
// Tests before can set state for next test execution
// Execution order and state change should be kept in mind
contract('CryptoPoliceCrowdsale', function(accounts) {
    describe("Before crowdsale started", function () {
        it("Payments will get rejected", function () {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return crowdsale.send(web3.toWei(1, "ether")).then(function() {
                    Assert.fail("Payment should have not been accepted");
                }).catch(function(error) {
                    Assert.ok(error.message.includes('revert'));
                })
            })
        });
        it("Admin can start crowdsale", startCrowdsale);
    });
    describe("After crowdsale started", function () {
        it("Payments will get rejected before exchange rate is set", function () {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return crowdsale.send(web3.toWei(0.01, "ether")).then(function() {
                    Assert.fail("Payment should have not been accepted");
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
        it("Payment under 0.01 ether will get rejected", function() {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return crowdsale.send(web3.toWei(0.009, "ether")).then(function() {
                    Assert.fail("Payment should have not been accepted");
                }).catch(function(error) {
                    Assert.ok(error.message.includes('revert'));
                })
            })
        });
        it("Payment of 0.01 ether will yield correct number of tokens in exchange", function() {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                const value = web3.toWei(0.01, "ether");
                const balanceBefore = web3.eth.getBalance(accounts[1]);
                const gasPrice = 10000000000;
                return crowdsale.sendTransaction({
                    from: accounts[1],
                    value: value,
                    gasPrice: gasPrice
                }).then(function(tx) {
                    const balanceAfter = web3.eth.getBalance(accounts[1]);
                    const calculatedBalanceAfter = balanceBefore.minus(value).minus(gasPrice * tx.receipt.gasUsed);
                    Assert.equal(balanceAfter.toString(), calculatedBalanceAfter.toString(), "Balance mismatch after ether sent");
                    return CryptoPoliceOfficerToken.deployed().then(function(token) {
                        return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                            Assert.equal(value.toString(), tokenCount.toString());
                        })
                    })
                }).catch(function(error) {
                    Assert.ok(false, error.message);
                });
            })
        });
    });
});