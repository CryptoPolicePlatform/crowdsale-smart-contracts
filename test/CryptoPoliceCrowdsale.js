const startCrowdsale = require('./../helpers/startCrowdsale');
const CryptoPoliceCrowdsale = artifacts.require("CryptoPoliceCrowdsale");
const CryptoPoliceOfficerToken = artifacts.require("CryptoPoliceOfficerToken");
const Assert = require('assert');
const BigNumber = require('bignumber.js');

const minCap = new BigNumber("12500000e+18");
const softCap = new BigNumber("40000000e+18");
const powerCap = new BigNumber("160000000e+18");
const hardCap = new BigNumber("400000000e+18");
const minSale = new BigNumber("1e+16");
const gasPrice = 10000000000;

const errorCallback = function(error) {
    Assert.ok(false, error.message);
};
const revertCallback = function(error) {
    Assert.ok(error.message.includes('revert'));
};

// BE AVARE THAT TESTS DEPEND ON EACH OTHER!!
// Tests beforehand can set state for next test execution
// Execution order and state change should be kept in mind
contract('CryptoPoliceCrowdsale', function(accounts) {
    describe("Before crowdsale is started", function () {
        it("Payment is rejected", function () {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return crowdsale.send(web3.toWei(1, "ether")).then(function() {
                    Assert.fail("Payment should have not been accepted");
                }).catch(revertCallback)
            })
        });
        it("Admin can start crowdsale", startCrowdsale);
    });
    describe("After crowdsale is started", function () {
        it("Reject payment when exchange rate is not set", function () {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return crowdsale.send(web3.toWei(0.01, "ether")).then(function() {
                    Assert.fail("Payment should have not been accepted");
                }).catch(revertCallback)
            })
        });
        it("Admin can update exchange rate", function() {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return crowdsale.updateExchangeRate(0, 1, 1).catch(errorCallback)
            })
        });
        it("Payment less that minimum sale is rejected", function() {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return crowdsale.send(web3.toWei(0.009, "ether")).then(function() {
                    Assert.fail("Payment should have not been accepted");
                }).catch(revertCallback)
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
                }).catch(errorCallback);
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
                    }).then(function() {
                        return CryptoPoliceOfficerToken.deployed().then(function(token) {
                            return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                                Assert.equal(tokenCount.toString(), minCap.toString());
                            })
                        })
                    }).catch(errorCallback);
                })
            })
        })
    });
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Funds are transfered to owner after crowdsale is ended successfully", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.updateExchangeRate(0, minCap, minSale).catch(errorCallback).then(function() {
                return crowdsale.sendTransaction({
                    from: accounts[1],
                    value: minSale
                }).then(function() {
                    const balanceBefore = web3.eth.getBalance(accounts[0]);
                    return crowdsale.endCrowdsale(true, { gasPrice: gasPrice }).then(function(tx) {
                        const balanceAfter = web3.eth.getBalance(accounts[0]);
                        const expectedBalance = balanceBefore.sub(tx.receipt.gasUsed * gasPrice).add(minSale);
                        Assert.equal(balanceAfter.toString(), expectedBalance.toString());
                    }).catch(errorCallback);
                }).catch(errorCallback);
            });
        })
    });
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Payment will get rejected after hard cap is reached", function() {
        const sale = minSale.div(4);
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.updateExchangeRate(0, minCap, sale).catch(errorCallback).then(function() {
                return crowdsale.updateExchangeRate(2, softCap, sale).catch(errorCallback).then(function() {
                    return crowdsale.updateExchangeRate(3, powerCap, sale).catch(errorCallback).then(function() {
                        return crowdsale.updateExchangeRate(4, hardCap, sale).catch(errorCallback).then(function() {
                            return crowdsale.sendTransaction({
                                from: accounts[1],
                                value: minSale
                            }).then(function() {
                                return crowdsale.sendTransaction({
                                    from: accounts[1],
                                    value: minSale
                                }).then(function() {
                                    Assert.ok(false, "Transaction was not rejected");
                                }).catch(revertCallback)
                            }).catch(errorCallback);
                        });
                    });
                });
            });
        })
    });
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Ethereum that is not exchanged is returned to sender", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.updateExchangeRate(0, minCap, minSale.sub(10)).catch(errorCallback).then(function() {
                return crowdsale.updateExchangeRate(2, minCap, minSale).catch(errorCallback).then(function() {
                    const balanceBefore = web3.eth.getBalance(accounts[1]);
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: minSale,
                        gasPrice: gasPrice
                    }).then(function(tx) {
                        const balanceAfter = web3.eth.getBalance(accounts[1]);
                        const expected = balanceBefore.sub(tx.receipt.gasUsed * gasPrice).sub(minSale).add(10);
                        Assert.equal(balanceAfter.toString(), expected.toString())
                    }).catch(errorCallback);
                })
            });
        })
    });
});