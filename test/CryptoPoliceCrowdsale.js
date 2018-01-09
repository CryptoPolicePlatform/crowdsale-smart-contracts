const startCrowdsaleHelper = require('./../helpers/startCrowdsale');
const CryptoPoliceCrowdsale = artifacts.require("CryptoPoliceCrowdsale");
const CryptoPoliceOfficerToken = artifacts.require("CryptoPoliceOfficerToken");
const Assert = require('assert');
const BigNumber = require('bignumber.js');
require('./../helpers/constants');

const revertCallback = function(error) {
    Assert.ok(error.message.includes('revert'));
};

const startCrowdsale = function () {
    return startCrowdsaleHelper(CryptoPoliceOfficerToken.deployed(), CryptoPoliceCrowdsale.deployed());
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
                return crowdsale.updateExchangeRate(0, minCap, minSale)
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
                    Assert.equal(balanceAfter.toString(), calculatedBalanceAfter.toString(),
                        "Balance mismatch after ether sent");
                    return CryptoPoliceOfficerToken.deployed().then(function(token) {
                        return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                            Assert.equal(tokenCount.toString(), minCap.toString());
                        })
                    })
                })
            })
        });
        describe("Before public token transfer is enabled", function() {
            it("Token transfer is rejected", function() {
                return CryptoPoliceOfficerToken.deployed().then(function(token) {
                    return token.transfer(accounts[2], 1, { from: accounts[1] }).catch(revertCallback);
                })
            });
            it("Token transfer via allowance is rejected", function() {
                return CryptoPoliceOfficerToken.deployed().then(function(token) {
                    return token.approve(accounts[2], 1, { from: accounts[1] }).then(function() {
                        return token.transferFrom(accounts[1], accounts[3], 1, { from: accounts[2] }).catch(revertCallback);
                    })
                })
            });
            it("Owner sets lock on tokens", function() {
                return CryptoPoliceOfficerToken.deployed().then(function(token) {
                    return token.balanceOf.call(accounts[0]).then(function(balance) {
                        return token.addTokenLock(balance, 0)
                    })
                }) 
            });
            it("Owner enables public token transfer", function() {
                return CryptoPoliceOfficerToken.deployed().then(function(token) {
                    return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                        return crowdsale.endCrowdsale(true).then(function() {
                            return token.enablePublicTransfers()
                        })
                    })
                }) 
            });
        });
        describe("After token transfer is enabled", function() {
            it("Owner cannot transfer locked tokens", function() {
                return CryptoPoliceOfficerToken.deployed().then(function(token) {
                    return token.transfer(accounts[1], 1).catch(revertCallback)
                })
            });
            it("Owner releases locked tokens", function() {
                return CryptoPoliceOfficerToken.deployed().then(function(token) {
                    return new Promise((resolve) => setTimeout(resolve, 1000)).then(function() {
                        return token.releaseLockedTokens(0)
                    })
                })
            });
            it("Owner transfers previously locked tokens", function() {
                return CryptoPoliceOfficerToken.deployed().then(function(token) {
                    return token.balanceOf.call(accounts[0]).then(function(transferAmount) {
                        return token.balanceOf.call(accounts[1]).then(function(recipientBalanceBefore) {
                            return token.transfer(accounts[1], transferAmount).then(function() {
                                return token.balanceOf.call(accounts[0]).then(function(balnaceAfterTransfer) {
                                    Assert.equal(balnaceAfterTransfer.toString(), "0");
                                    return token.balanceOf.call(accounts[1]).then(function(recipientBalanceAfter) {
                                        const expected = recipientBalanceBefore.add(transferAmount);
                                        Assert.equal(recipientBalanceAfter.toString(), expected.toString());
                                    });
                                });
                            })
                        })
                    })
                }) 
            });
            it("Can transfer tokens", function() {
                return CryptoPoliceOfficerToken.deployed().then(function(token) {
                    return token.transfer(accounts[2], 1, { from: accounts[1] }).then(function(){
                        return token.balanceOf.call(accounts[2]).then(function(tokenCount) {
                            Assert.equal(tokenCount.toString(), 1);
                        })
                    })
                })
            });
            it("Can transfer tokens via allowance", function() {
                return CryptoPoliceOfficerToken.deployed().then(function(token) {
                    return token.approve(accounts[2], 1, { from: accounts[1] }).then(function() {
                        return token.transferFrom(accounts[1], accounts[3], 1, { from: accounts[2] }).then(function() {
                            return token.balanceOf.call(accounts[3]).then(function(tokenCount) {
                                Assert.equal(tokenCount.toString(), 1);
                            })
                        })
                    })
                })
            });
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
    it("Burn leftover tokens in various portions", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.updateExchangeRate(0, minCap, minSale).then(function() {
                return crowdsale.sendTransaction({
                    from: accounts[1],
                    value: minSale
                }).then(function() {
                    return crowdsale.endCrowdsale(true).then(function() {
                        return CryptoPoliceOfficerToken.deployed().then(function(token) {
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
        });
    })
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Large exchange happens only after transaction is verified", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
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
        });
    })
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Return suspended funds once", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
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
        });
    })
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Payment is rejected on paused crowdsale", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.updateExchangeRate(0, minCap, minSale).then(function() {
                return crowdsale.pauseCrowdsale().then(function() {
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: minSale
                    }).catch(revertCallback)
                })
            })
        });
    })
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Proxy exchange", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
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
    });
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(function() {
        return startCrowdsale().then(function() {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return crowdsale.updateExchangeRate(0, 1, minSale).then(function() {
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: minSale
                    }).then(function() {
                        return crowdsale.sendTransaction({
                            from: accounts[2],
                            value: minSale
                        }).then(function() {
                            return crowdsale.endCrowdsale(false)
                        })
                    })
                })
            })
        })
    });
    describe("Refund after unsuccessful crowdsale", function() {
        it("Issue manual refund with payment method", function() {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                const balnace1AfterTx = web3.eth.getBalance(accounts[1]);
                return crowdsale.sendTransaction({
                    from: accounts[1],
                    value: 1,
                    gasPrice: gasPrice
                }).then(function(tx) {
                    const balance1AfterRefund = web3.eth.getBalance(accounts[1]);
                    const balance1Expected = balnace1AfterTx.add(minSale).minus(gasPrice * tx.receipt.gasUsed);
                    Assert.equal(balance1AfterRefund.toString(), balance1Expected.toString());
                })
            })
        });
        it("Refund by admin", function() {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                const balnace2AfterTx = web3.eth.getBalance(accounts[2]);
                return crowdsale.refund(accounts[2]).then(function() {
                    const balance2AfterRefund = web3.eth.getBalance(accounts[2]);
                    Assert.equal(balance2AfterRefund.toString(), balnace2AfterTx.toString());
                })
            })
        })
    })
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Owner issues money back", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.updateExchangeRate(0, 1, minSale).then(function() {
                return crowdsale.sendTransaction({
                    from: accounts[1],
                    value: minSale
                }).then(function() {
                    return CryptoPoliceOfficerToken.deployed().then(function(token) {
                        const ethBalanceBefore = web3.eth.getBalance(accounts[1]);
                        return crowdsale.moneyBack(accounts[1]).then(function() {
                            return token.balanceOf.call(crowdsale.address).then(function(tokenBalanceAfter) {
                                Assert.equal(tokenBalanceAfter.toString(), hardCap.toString());
                                const ethBalanceAfter = web3.eth.getBalance(accounts[1]);
                                const ethBalanceExpected = ethBalanceBefore.add(minSale);
                                Assert.equal(ethBalanceAfter.toString(), ethBalanceExpected.toString());
                            })
                        })
                    })
                })
            })
        })
    })
});