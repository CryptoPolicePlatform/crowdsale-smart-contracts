const startCrowdsale = require('./../helpers/startCrowdsale');
const CryptoPoliceCrowdsale = artifacts.require("CryptoPoliceCrowdsale");
const CryptoPoliceOfficerToken = artifacts.require("CryptoPoliceOfficerToken");
const Assert = require('assert');
const BigNumber = require('bignumber.js');

const minCap = new BigNumber("12500000e+18");
const minSale = new BigNumber("1e+16");
const gasPrice = 10000000000;

// BE AVARE THAT TESTS DEPEND ON EACH OTHER!!
// Tests beforehand can set state for next test execution
// Execution order and state change should be kept in mind
contract('CryptoPoliceCrowdsale', function(accounts) {
    describe("Before crowdsale is started", function () {
        it("Payment is rejected", function () {
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
    describe("After crowdsale is started", function () {
        it("Reject payment when exchange rate is not set", function () {
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
        it("Payment less that minimum sale is rejected", function() {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return crowdsale.send(web3.toWei(0.009, "ether")).then(function() {
                    Assert.fail("Payment should have not been accepted");
                }).catch(function(error) {
                    Assert.ok(error.message.includes('revert'));
                })
            })
        });
        it("Payment will yield correct number of tokens in return", function() {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                const balanceBefore = web3.eth.getBalance(accounts[1]);
                return crowdsale.sendTransaction({
                    from: accounts[1],
                    value: minSale,
                    gasPrice: gasPrice
                }).then(function(tx) {
                    const balanceAfter = web3.eth.getBalance(accounts[1]);
                    const calculatedBalanceAfter = balanceBefore.minus(minSale).minus(gasPrice * tx.receipt.gasUsed);
                    Assert.equal(balanceAfter.toString(), calculatedBalanceAfter.toString(), "Balance mismatch after ether sent");
                    return CryptoPoliceOfficerToken.deployed().then(function(token) {
                        return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                            Assert.equal(minSale.toString(), tokenCount.toString());
                        })
                    })
                }).catch(function(error) {
                    Assert.ok(false, error.message);
                });
            })
        });
    });
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Multiple exchange rates can apply within same cap", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            const batchPrice = minSale.div(4);
            return crowdsale.updateExchangeRate(0, minCap.div(2).sub(1), batchPrice).catch(function(error) {
                Assert.ok(false, error.message);
            }).then(function() {
                return crowdsale.updateExchangeRate(2, 1, batchPrice).catch(function(error) {
                    Assert.ok(false, error.message);
                }).then(function() {
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: minSale
                    }).then(function(tx) {
                        return CryptoPoliceOfficerToken.deployed().then(function(token) {
                            return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                                Assert.equal(tokenCount.toString(), minCap.toString());
                            })
                        })
                    }).catch(function(error) {
                        Assert.ok(false, error.message);
                    });
                })
            })
        })
    })
});