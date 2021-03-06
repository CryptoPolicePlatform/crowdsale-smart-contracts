const startCrowdsaleHelper = require('./../helpers/startCrowdsale');
const CryptoPoliceProxy = artifacts.require("CryptoPoliceProxy");
const CryptoPoliceCrowdsale = artifacts.require("CryptoPoliceCrowdsale");
const CryptoPoliceOfficerToken = artifacts.require("CryptoPoliceOfficerToken");
const Assert = require('assert');
const constants = require('./../helpers/constants');
const BN = require('bn.js');
const revertCallback = function(error) {
    Assert.ok(error.message.includes('revert'));
};
const getBalance = account => web3.eth.getBalance(account).then(balance => new BN(balance));
const getTxCost = tx => new BN(constants.gasPrice * tx.receipt.gasUsed);

const startCrowdsale = function () {
    return CryptoPoliceOfficerToken.deployed().then(function (token) {
        return token.owner.call().then(function (owner) {
            return startCrowdsaleHelper(CryptoPoliceOfficerToken.deployed(),
                CryptoPoliceCrowdsale.deployed(), owner, CryptoPoliceProxy.deployed());
        })
    })
};

// BE AVARE THAT TESTS DEPEND ON EACH OTHER!!
// Tests beforehand can set state for next test execution
// Execution order and state change should be kept in mind
contract('CryptoPoliceCrowdsale', function(accounts) {
    describe("Before crowdsale is started", function () {
        it("Payment is rejected", function () {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return crowdsale.send(web3.utils.toWei("1", "ether")).then(function() {
                    Assert.fail("Payment should have not been accepted");
                }).catch(revertCallback)
            })
        });
        it("Admin can start crowdsale", startCrowdsale);
    });
    describe("After crowdsale is started", function () {
        it("Reject payment when exchange rate is not set", function () {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return crowdsale.send(web3.utils.toWei("0.01", "ether")).then(function() {
                    Assert.fail("Payment should have not been accepted");
                }).catch(revertCallback)
            })
        });
        it("Admin can update exchange rate", function() {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return crowdsale.updateExchangeRate(0, constants.minCap, constants.minSale)
            })
        });
        it("Payment less that minimum sale is rejected", function() {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return crowdsale.send(web3.utils.toWei("0.009", "ether")).then(function() {
                    Assert.fail("Payment should have not been accepted");
                }).catch(revertCallback)
            })
        });
        it("Payment will yield correct number of tokens in return", function() {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return web3.eth.getBalance(accounts[1]).then(balance => {
                    const balanceBefore = new BN(balance);
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: constants.minSale,
                        gasPrice: constants.gasPrice
                    }).then(function(tx) {
                        return web3.eth.getBalance(accounts[1]).then(balance => {
                            const balanceAfter = new BN(balance);
                            const calculatedBalanceAfter = balanceBefore.sub(constants.minSale)
                                .sub(new BN(constants.gasPrice * tx.receipt.gasUsed));
                            Assert.equal(balanceAfter.toString(), calculatedBalanceAfter.toString(),
                                "Balance mismatch after ether sent");
                            return CryptoPoliceOfficerToken.deployed().then(function(token) {
                                return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                                    Assert.equal(tokenCount.toString(), constants.minCap.toString());
                                })
                            })
                        })
                    })
                })
            })
        });
        describe("Before public token transfer is enabled", function() {
            it("Token transfer is rejected", function() {
                return CryptoPoliceOfficerToken.deployed().then(function(token) {
                    return token.transfer(accounts[2], 1, { from: accounts[1] }).catch(revertCallback)
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
            const batchPrice = constants.minSale.div(new BN(4));
            return crowdsale.updateExchangeRate(0, constants.minCap.div(new BN(2)).sub(new BN(1)), batchPrice).catch(function(error) {
                Assert.ok(false, error.message);
            }).then(function() {
                return crowdsale.updateExchangeRate(1, 1, batchPrice).catch(function(error) {
                    Assert.ok(false, error.message);
                }).then(function() {
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: constants.minSale
                    }).then(function() {
                        return CryptoPoliceOfficerToken.deployed().then(function(token) {
                            return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                                Assert.equal(tokenCount.toString(), constants.minCap.toString());
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
            return crowdsale.updateExchangeRate(0, constants.minCap, constants.minSale).then(function() {
                return crowdsale.sendTransaction({
                    from: accounts[1],
                    value: constants.minSale
                }).then(function() {
                    return getBalance(accounts[0]).then(balanceBefore => {
                        return crowdsale.endCrowdsale(true, { gasPrice: constants.gasPrice }).then(function(tx) {
                            return getBalance(accounts[0]).then(balanceAfter => {
                                const expectedBalance = balanceBefore.sub(getTxCost(tx)).add(constants.minSale);
                                Assert.equal(balanceAfter.toString(), expectedBalance.toString());
                            })
                        })
                    })
                })
            });
        })
    });
    it("Payment is rejected after crowdsale is ended", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.updateExchangeRate(1, constants.minCap, constants.minSale).then(function() {
                return crowdsale.sendTransaction({
                    from: accounts[2],
                    value: constants.minSale
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
        const sale = constants.minSale.div(new BN(4));
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.updateExchangeRate(0, constants.minCap, sale).then(function() {
                return crowdsale.updateExchangeRate(1, constants.softCap, sale).then(function() {
                    return crowdsale.updateExchangeRate(2, constants.powerCap, sale).then(function() {
                        return crowdsale.updateExchangeRate(3, constants.hardCap, sale).then(function() {
                            return crowdsale.sendTransaction({
                                from: accounts[1],
                                value: constants.minSale
                            }).then(function() {
                                return crowdsale.sendTransaction({
                                    from: accounts[1],
                                    value: constants.minSale
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
            return crowdsale.updateExchangeRate(0, constants.minCap, constants.minSale.sub(new BN(10))).then(function() {
                return crowdsale.updateExchangeRate(1, constants.minCap, constants.minSale).then(function() {
                    return getBalance(accounts[1]).then(balanceBefore => {
                        return crowdsale.sendTransaction({
                            from: accounts[1],
                            value: constants.minSale,
                            gasPrice: constants.gasPrice
                        }).then(function(tx) {
                            return getBalance(accounts[1]).then(balanceAfter => {
                                const expected = balanceBefore.sub(getTxCost(tx)).sub(constants.minSale).add(new BN(10));
                                Assert.equal(balanceAfter.toString(), expected.toString())
                            })
                        })
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
            return crowdsale.updateExchangeRate(0, constants.minCap, constants.minSale).then(function() {
                return crowdsale.sendTransaction({
                    from: accounts[1],
                    value: constants.minSale
                }).then(function() {
                    return crowdsale.endCrowdsale(true).then(function() {
                        return CryptoPoliceOfficerToken.deployed().then(function(token) {
                            return token.totalSupply.call().then(function(originalSupply) {
                                return crowdsale.burnLeftoverTokens(50).then(function() {
                                    return token.totalSupply.call().then(function(supply) {
                                        const expected = originalSupply.sub(constants.hardCap.sub(constants.minCap).div(new BN(2)));
                                        Assert.equal(supply.toString(), expected.toString());
                                        return crowdsale.burnLeftoverTokens(100).then(function() {
                                            return token.totalSupply.call().then(function(supply) {
                                                const expected = originalSupply.sub(constants.hardCap.sub(constants.minCap));
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
            return crowdsale.updateExchangeRate(0, constants.minCap, constants.unidentifiedSaleLimit.add(new BN(1))).then(function() {
                return crowdsale.updateUnidentifiedSaleLimit(constants.unidentifiedSaleLimit).then(function() {
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: constants.unidentifiedSaleLimit.add(new BN(1))
                    }).then(function() {
                        return CryptoPoliceOfficerToken.deployed().then(function(token) {
                            return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                                Assert.equal("0", tokenCount.toString());
                                return crowdsale.markParticipantIdentifiend(accounts[1]).then(function() {
                                    return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                                        Assert.equal(constants.minCap.toString(), tokenCount.toString());
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
            const transferAmount = constants.unidentifiedSaleLimit.add(new BN(1));
            return crowdsale.updateExchangeRate(0, constants.minCap, transferAmount).then(function() {
                return crowdsale.updateUnidentifiedSaleLimit(constants.unidentifiedSaleLimit).then(function() {
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: transferAmount
                    }).then(function() {
                        return getBalance(accounts[1]).then(balanceBefore => {
                            return crowdsale.returnSuspendedPayments(accounts[1]).then(function() {
                                return getBalance(accounts[1]).then(balanceAfter => {
                                    const expectedBalance = balanceBefore.add(transferAmount);
                                    Assert.equal(balanceAfter.toString(), expectedBalance.toString());
                                    return crowdsale.returnSuspendedPayments(accounts[1]).catch(revertCallback)
                                });
                            })
                        });
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
            return crowdsale.updateExchangeRate(0, constants.minCap, constants.minSale).then(function() {
                return crowdsale.pauseCrowdsale().then(function() {
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: constants.minSale
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
            return crowdsale.updateExchangeRate(0, constants.minCap, constants.minSale).then(function() {
                return crowdsale.proxyExchange(accounts[1], constants.minSale, "reference", web3.utils.utf8ToHex("checksum")).then(function() {
                    return CryptoPoliceOfficerToken.deployed().then(function(token) {
                        return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                            Assert.equal(constants.minCap.toString(), tokenCount.toString());
                        })
                    })
                })
            })
        })
    });
    it("Proxy exchange different beneficiary", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.updateExchangeRate(1, 1, constants.minSale).then(function() {
                return crowdsale.proxyExchange(accounts[2], constants.minSale, "reference", web3.utils.utf8ToHex("checksum"))
                    .catch(revertCallback)
            })
        })
    });
    it("Proxy exchange with different reference but same checksum", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.updateExchangeRate(2, 1, constants.minSale).then(function() {
                return crowdsale.proxyExchange(accounts[1], constants.minSale, "reference1", web3.utils.utf8ToHex("checksum"))
                    .catch(revertCallback)
            })
        })
    });
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(function() {
        return startCrowdsale().then(function() {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return crowdsale.updateExchangeRate(0, 1, constants.minSale).then(function() {
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: constants.minSale
                    }).then(function() {
                        return crowdsale.sendTransaction({
                            from: accounts[2],
                            value: constants.minSale
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
                return getBalance(accounts[1]).then(balnace1AfterTx => {
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: 1,
                        gasPrice: constants.gasPrice
                    }).then(function(tx) {
                        return getBalance(accounts[1]).then(balance1AfterRefund => {
                            const balance1Expected = balnace1AfterTx.add(constants.minSale)
                                .sub(getTxCost(tx));
                            Assert.equal(balance1AfterRefund.toString(), balance1Expected.toString());
                        });
                    })
                })
            })
        });
        it("Refund by admin", function() {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return web3.eth.getBalance(accounts[2]).then(balance => {
                    const balnace2AfterTx = new BN(balance);
                    return crowdsale.refund(accounts[2]).then(function() {
                        return web3.eth.getBalance(accounts[2]).then(balance => {
                            const balance2AfterRefund = new BN(balance);
                            Assert.equal(balance2AfterRefund.toString(), balnace2AfterTx.add(constants.minSale).toString());
                        })
                    })
                })
            })
        })
    })
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Balance not changed when proxy exchange has reminder", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.updateExchangeRate(0, 1, constants.minSale).then(function() {
                // add eth to contract's balance
                return crowdsale.sendTransaction({
                    from: accounts[1],
                    value: constants.minSale
                }).then(function () {
                    return web3.eth.getBalance(accounts[2]).then(balance => {
                        const balanceBefore = new BN(balance);
                        return crowdsale.proxyExchange(accounts[2], constants.minSale.add(new BN(1)), "r", web3.utils.utf8ToHex("c"))
                            .then(function() {
                                return web3.eth.getBalance(accounts[2]).then(balance => {
                                    const balanceAfter = new BN(balance);
                                    Assert.equal(balanceBefore.toString(), balanceAfter.toString());
                                })
                            })
                    })
                })
            })
        })
    })
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Suspended amount is not transfered when crowdsale ended", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.updateExchangeRate(0, 1, constants.minSale).then(function() {
                return web3.eth.getBalance(accounts[0]).then(balance => {
                    const balanceBefore = new BN(balance);
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: constants.minSale
                    }).then(function () {
                        return crowdsale.sendTransaction({
                            from: accounts[2],
                            value: constants.unidentifiedSaleLimit.add(constants.minSale)
                        }).then(function () {
                            return crowdsale.endCrowdsale(true, { gasPrice: constants.gasPrice }).then(function(tx) {
                                return web3.eth.getBalance(accounts[0]).then(balance => {
                                    const balanceAfter = new BN(balance);
                                    const balanceExpected = balanceBefore.add(constants.minSale).sub(new BN(constants.gasPrice * tx.receipt.gasUsed));
                                    Assert.equal(balanceAfter.toString(), balanceExpected.toString());
                                })
                            })
                        })
                    })
                })
            })
        })
    })
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Unidentify", function() {
        
    })
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Multiple suspended external payments are processed when participant identified", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.updateExchangeRate(0, 1, 1).then(function() {
                return crowdsale.updateUnidentifiedSaleLimit(1).then(function() {
                    return crowdsale.updateMinSale(1).then(function () {
                        return crowdsale.proxyExchange(accounts[1], 2, "reference", web3.utils.utf8ToHex("checksum")).then(function() {
                            return crowdsale.proxyExchange(accounts[1], 2, "reference1", web3.utils.utf8ToHex("checksum1")).then(function() {
                                return crowdsale.markParticipantIdentifiend(accounts[1]).then(function() {
                                    return CryptoPoliceOfficerToken.deployed().then(function(token) {
                                        return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                                            Assert.equal(tokenCount.toString(), "4");
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
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Admin transfers Ethereum after release treshold is reached", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.updateExchangeRate(0, constants.releaseThreshold, constants.minSale).then(function() {
                return crowdsale.updateUnidentifiedSaleLimit(constants.minSale.add(new BN(1))).then(function() {
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: constants.minSale
                    }).then(function(tx) {
                        return web3.eth.getBalance(accounts[0]).then(balance => {
                            const balanceBefore = new BN(balance);
                            return crowdsale.transwerFunds(constants.minSale, {
                                gasPrice: constants.gasPrice
                            }).then(function (tx) {
                                return web3.eth.getBalance(accounts[0]).then(balance => {
                                    const balanceAfter = new BN(balance);
                                    const calculatedBalanceAfter = balanceBefore.sub(new BN(constants.gasPrice * tx.receipt.gasUsed))
                                        .add(constants.minSale);
                                    Assert.equal(balanceAfter.toString(), calculatedBalanceAfter.toString());
                                })
                            });
                        })
                    })
                })
            })
        })
    })
});