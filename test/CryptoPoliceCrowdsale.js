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
const maxUnidentifiedInvestment = minSale.add(1);

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
                return crowdsale.updateExchangeRate(0, 1, 1)
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
                return crowdsale.startClosedPresaleStage().then(function () {
                    const balanceBefore = web3.eth.getBalance(accounts[1]);
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: minSale,
                        gasPrice: gasPrice
                    }).then(function(tx) {
                        const balanceAfter = web3.eth.getBalance(accounts[1]);
                        const calculatedBalanceAfter = balanceBefore.minus(minSale).minus(gasPrice * tx.receipt.gasUsed);
                        Assert.equal(balanceAfter.toString(), calculatedBalanceAfter.toString(),
                            "Balance mismatch after ether sent");
                        return CryptoPoliceOfficerToken.deployed().then(function(token) {
                            return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                                Assert.equal(minSale.toString(), tokenCount.toString());
                            })
                        })
                    })
                })
            })
        });
    });
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Multiple exchange rates can apply within same cap", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.startClosedPresaleStage().then(function () {
                const batchPrice = minSale.div(4);
                return crowdsale.updateExchangeRate(0, minCap.div(2).sub(1), batchPrice).catch(function(error) {
                    Assert.ok(false, error.message);
                }).then(function() {
                    return crowdsale.updateExchangeRate(1, 1, batchPrice).catch(function(error) {
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
                        })
                    })
                })
            })
        })
    });
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Funds are transfered to owner after crowdsale is ended successfully", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.updateExchangeRate(0, minCap, minSale).then(function() {
                return crowdsale.sendTransaction({
                    from: accounts[1],
                    value: minSale
                }).then(function() {
                    const balanceBefore = web3.eth.getBalance(accounts[0]);
                    return crowdsale.endCrowdsale(true, { gasPrice: gasPrice }).then(function(tx) {
                        const balanceAfter = web3.eth.getBalance(accounts[0]);
                        const expectedBalance = balanceBefore.sub(tx.receipt.gasUsed * gasPrice).add(minSale);
                        Assert.equal(balanceAfter.toString(), expectedBalance.toString());
                    })
                })
            });
        })
    });
    it("Payment is rejected after crowdsale is ended", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.updateExchangeRate(1, minCap, minSale).then(function() {
                return crowdsale.sendTransaction({
                    from: accounts[2],
                    value: minSale
                }).then(function() {
                    Assert.ok(false, "Transaction was not rejected");
                }).catch(revertCallback);
            });
        })
    });
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Payment is rejected after hard cap is reached", function() {
        const sale = minSale.div(4);
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.updateExchangeRate(0, minCap, sale).then(function() {
                return crowdsale.updateExchangeRate(1, softCap, sale).then(function() {
                    return crowdsale.updateExchangeRate(2, powerCap, sale).then(function() {
                        return crowdsale.updateExchangeRate(3, hardCap, sale).then(function() {
                            return crowdsale.startClosedPresaleStage().then(function () {
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
                                })
                            });
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
            return crowdsale.updateExchangeRate(0, minCap, minSale.sub(10)).then(function() {
                return crowdsale.updateExchangeRate(1, minCap, minSale).then(function() {
                    const balanceBefore = web3.eth.getBalance(accounts[1]);
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: minSale,
                        gasPrice: gasPrice
                    }).then(function(tx) {
                        const balanceAfter = web3.eth.getBalance(accounts[1]);
                        const expected = balanceBefore.sub(tx.receipt.gasUsed * gasPrice).sub(minSale).add(10);
                        Assert.equal(balanceAfter.toString(), expected.toString())
                    })
                })
            });
        })
    });
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Tokens are reserved", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.updateExchangeRate(0, minCap, minSale).then(function() {
                return crowdsale.sendTransaction({
                    from: accounts[1],
                    value: minSale
                }).then(function() {
                    return CryptoPoliceOfficerToken.deployed().then(function(token) {
                        return token.balanceOf.call(accounts[1]).then(function(balance) {
                            Assert.equal(balance.toString(), "0", "After tokens are reserved balance should not change");
                            return crowdsale.reservedTokens.call(accounts[1]).then(function(amount) {
                                Assert.equal(amount.toString(), minCap.toString(), "Invalid amount of tokens reserved")
                            })
                        })
                    })
                })
            })
        })
    });
    it("Owner transfers reserved tokens", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.transferReservedTokens(accounts[1]).then(function() {
                return CryptoPoliceOfficerToken.deployed().then(function(token) {
                    return token.balanceOf.call(accounts[1]).then(function(balance) {
                        Assert.equal(balance.toString(), minCap.toString(), "Tokens were not transfered correctly");
                        return crowdsale.reservedTokens.call(accounts[1]).then(function(amount) {
                            Assert.equal(amount.toString(), "0", "After token transfer reserved number of tokens should be zero")
                        })
                    })
                })
            })
        })
    })
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Burn leftover tokens in various portions", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.startClosedPresaleStage().then(function () {
                return crowdsale.updateExchangeRate(0, minCap, minSale).then(function() {
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: minSale
                    }).then(function() {
                        return crowdsale.endCrowdsale(true).then(function() {
                            return CryptoPoliceOfficerToken.deployed().then(function(token) {
                                return token.grantBurn(crowdsale.address).then(function() {
                                    return token.totalSupply.call().then(function(originalSupply) {
                                        return crowdsale.burnLeftoverTokens(50).then(function() {
                                            return token.totalSupply.call().then(function(supply) {
                                                const expected = originalSupply.sub(hardCap.sub(minCap).div(2));
                                                Assert.equal(supply.toString(), expected.toString());
                                                return crowdsale.burnLeftoverTokens(100).then(function() {
                                                    return token.totalSupply.call().then(function(supply) {
                                                        const expected = originalSupply.sub(hardCap.sub(minCap));
                                                        Assert.equal(supply.toString(), expected.toString());
                                                    })
                                                })
                                            })
                                        })
                                    })
                                })
                            })
                        })
                    })
                })
            })
        });
    })
});contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Burn leftover tokens in various portions", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.startClosedPresaleStage().then(function () {
                return crowdsale.updateExchangeRate(0, minCap, minSale).then(function() {
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: minSale
                    }).then(function() {
                        return crowdsale.endCrowdsale(true).then(function() {
                            return CryptoPoliceOfficerToken.deployed().then(function(token) {
                                return token.grantBurn(crowdsale.address).then(function() {
                                    return token.totalSupply.call().then(function(originalSupply) {
                                        return crowdsale.burnLeftoverTokens(50).then(function() {
                                            return token.totalSupply.call().then(function(supply) {
                                                const expected = originalSupply.sub(hardCap.sub(minCap).div(2));
                                                Assert.equal(supply.toString(), expected.toString());
                                                return crowdsale.burnLeftoverTokens(100).then(function() {
                                                    return token.totalSupply.call().then(function(supply) {
                                                        const expected = originalSupply.sub(hardCap.sub(minCap));
                                                        Assert.equal(supply.toString(), expected.toString());
                                                    })
                                                })
                                            })
                                        })
                                    })
                                })
                            })
                        })
                    })
                })
            })
        });
    })
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Large exchange happens only after transaction is verified", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.startClosedPresaleStage().then(function () {
                return crowdsale.updateExchangeRate(0, minCap, maxUnidentifiedInvestment.add(1)).then(function() {
                    return crowdsale.updateMaxUnidentifiedInvestment(maxUnidentifiedInvestment).then(function() {
                        return crowdsale.sendTransaction({
                            from: accounts[1],
                            value: maxUnidentifiedInvestment.add(1)
                        }).then(function() {
                            return CryptoPoliceOfficerToken.deployed().then(function(token) {
                                return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                                    Assert.equal("0", tokenCount.toString());
                                    return crowdsale.markAddressIdentified(accounts[1]).then(function() {
                                        return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                                            Assert.equal(minCap.toString(), tokenCount.toString());
                                        })
                                    })
                                })
                            })
                        })
                    })
                })
            })
        });
    })
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Return suspended funds once", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.startClosedPresaleStage().then(function () {
                const transferAmount = maxUnidentifiedInvestment.add(1);
                return crowdsale.updateExchangeRate(0, minCap, transferAmount).then(function() {
                    return crowdsale.updateMaxUnidentifiedInvestment(maxUnidentifiedInvestment).then(function() {
                        return crowdsale.sendTransaction({
                            from: accounts[1],
                            value: transferAmount
                        }).then(function() {
                            const balanceBefore = web3.eth.getBalance(accounts[1]);
                            return crowdsale.returnSuspendedFunds(accounts[1]).then(function() {
                                const balanceAfter = web3.eth.getBalance(accounts[1]);
                                const expectedBalance = balanceBefore.add(transferAmount);
                                Assert.equal(balanceAfter.toString(), expectedBalance.toString());
                                return crowdsale.returnSuspendedFunds(accounts[1]).catch(revertCallback)
                            })
                        })
                    })
                })
            })
        });
    })
});contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Return suspended funds once", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.startClosedPresaleStage().then(function () {
                const transferAmount = maxUnidentifiedInvestment.add(1);
                return crowdsale.updateExchangeRate(0, minCap, transferAmount).then(function() {
                    return crowdsale.updateMaxUnidentifiedInvestment(maxUnidentifiedInvestment).then(function() {
                        return crowdsale.sendTransaction({
                            from: accounts[1],
                            value: transferAmount
                        }).then(function() {
                            const balanceBefore = web3.eth.getBalance(accounts[1]);
                            return crowdsale.returnSuspendedFunds(accounts[1]).then(function() {
                                const balanceAfter = web3.eth.getBalance(accounts[1]);
                                const expectedBalance = balanceBefore.add(transferAmount);
                                Assert.equal(balanceAfter.toString(), expectedBalance.toString());
                                return crowdsale.returnSuspendedFunds(accounts[1]).catch(revertCallback)
                            })
                        })
                    })
                })
            })
        });
    })
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Payment is rejected on paused crowdsale", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.startClosedPresaleStage().then(function () {
                return crowdsale.updateExchangeRate(0, minCap, minSale).then(function() {
                    return crowdsale.pauseCrowdsale().then(function() {
                        return crowdsale.sendTransaction({
                            from: accounts[1],
                            value: minSale
                        }).catch(revertCallback)
                    })
                })
            })
        });
    })
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Proxy exchange", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.startClosedPresaleStage().then(function () {
                return crowdsale.updateExchangeRate(0, minCap, minSale).then(function() {
                    return crowdsale.proxyExchange(accounts[1], minSale).then(function() {
                        return CryptoPoliceOfficerToken.deployed().then(function(token) {
                            return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                                Assert.equal(minCap.toString(), tokenCount.toString());
                            })
                        })
                    })
                })
            })
        })
    });
});

// TODO
// refund after unsuccessful crowdsale