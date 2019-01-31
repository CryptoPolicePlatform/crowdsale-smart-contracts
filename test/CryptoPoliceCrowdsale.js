'use strict';
const startCrowdsaleHelper = require('./../helpers/startCrowdsale');
const CryptoPoliceProxy = artifacts.require("CryptoPoliceProxy");
const CryptoPoliceCrowdsale = artifacts.require("CryptoPoliceCrowdsale");
const CryptoPoliceOfficerToken = artifacts.require("CryptoPoliceOfficerToken");
const Assert = require('assert');
const constants = require('./../helpers/constants');
const BN = require('bn.js');
const whenReverted = /VM Exception while processing transaction: revert/
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
                Assert.rejects(crowdsale.send(web3.utils.toWei("1", "ether")), whenReverted)
            })
        });
        it("Admin can start crowdsale", startCrowdsale);
    });
    describe("After crowdsale is started", function () {
        it("Reject payment when exchange rate is not set", function () {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                Assert.rejects(crowdsale.send(web3.utils.toWei("0.01", "ether")), whenReverted)
            })
        });
        it("Admin can update exchange rate", function() {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                return crowdsale.setExchangeRate(1, constants.minSale)
            })
        });
        it("Payment less that minimum sale is rejected", function() {
            return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
                Assert.rejects(crowdsale.send(web3.utils.toWei("0.009", "ether")), whenReverted)
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
                                    Assert.equal(tokenCount.toString(10), "1");
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
                    Assert.rejects(token.transfer(accounts[2], 1, { from: accounts[1] }), whenReverted)
                })
            });
            it("Token transfer via allowance is rejected", function() {
                return CryptoPoliceOfficerToken.deployed().then(function(token) {
                    return token.approve(accounts[2], 1, { from: accounts[1] }).then(function() {
                        Assert.rejects(token.transferFrom(accounts[1], accounts[3], 1, { from: accounts[2] }), whenReverted);
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
                    Assert.rejects(token.transfer(accounts[1], 1), whenReverted)
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
    it("Funds are transfered to owner after crowdsale is ended successfully", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.setExchangeRate(1, constants.minSale).then(function() {
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
            Assert.rejects(crowdsale.sendTransaction({
                from: accounts[2],
                value: constants.minSale
            }).then(function() {
                Assert.ok(false, "Transaction was not rejected");
            }), whenReverted);
        })
    });
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Payment is rejected after hard cap is reached", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.setExchangeRate(constants.hardCap, constants.minSale).then(function() {
                return crowdsale.sendTransaction({
                    from: accounts[1],
                    value: constants.minSale
                }).then(tx => {
                    Assert.ok(tx.logs.length)
                    const event = tx.logs[1];
                    Assert.equal(event.event, "TokensSoldOut");
                    Assert.rejects(crowdsale.sendTransaction({
                        from: accounts[1],
                        value: constants.minSale
                    }), /Crowdsale currently inactive/)
                })
            })
        })
    })
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Payment remainder is returned back to sender", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.setExchangeRate(1, constants.minSale).then(function() {
                return getBalance(accounts[1]).then(balanceBefore => {
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: constants.minSale.add(new BN(1)),
                        gasPrice: constants.gasPrice
                    }).then(function(tx) {
                        return getBalance(accounts[1]).then(balanceAfter => {
                            const expected = balanceBefore.sub(getTxCost(tx)).sub(constants.minSale);
                            Assert.equal(balanceAfter.toString(), expected.toString())
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
            return crowdsale.setExchangeRate(1, constants.minSale).then(function() {
                return crowdsale.sendTransaction({
                    from: accounts[1],
                    value: constants.minSale
                }).then(function() {
                    return crowdsale.endCrowdsale(true).then(function() {
                        return CryptoPoliceOfficerToken.deployed().then(function(token) {
                            return token.totalSupply.call().then(function(originalSupply) {
                                return crowdsale.burnLeftoverTokens(50).then(function() {
                                    return token.totalSupply.call().then(function(supply) {
                                        const expected = originalSupply.sub(constants.hardCap.sub(new BN(1)).div(new BN(2)));
                                        Assert.equal(supply.toString(), expected.toString());
                                        return crowdsale.burnLeftoverTokens(100).then(function() {
                                            return token.totalSupply.call().then(function(supply) {
                                                const expected = originalSupply.sub(constants.hardCap.sub(new BN(1)));
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
    it("Tokens are exchanged after participant is set as KYC compliant", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.setExchangeRate(1, constants.minSale).then(function() {
                return crowdsale.setCumulativePaymentLimitOfNonKycCompliantParticipant(constants.minSale.sub(new BN(1))).then(function() {
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: constants.minSale
                    }).then(function() {
                        return CryptoPoliceOfficerToken.deployed().then(function(token) {
                            return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                                Assert.equal(tokenCount.toString(), "0");
                                return crowdsale.setParticipantIsKycCompliant(accounts[1]).then(function() {
                                    return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                                        Assert.equal(tokenCount.toString(10), "1");
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
    it("Refund suspended payment", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.setExchangeRate(1, constants.minSale).then(function() {
                return crowdsale.setCumulativePaymentLimitOfNonKycCompliantParticipant(constants.minSale.sub(new BN(1))).then(function() {
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: constants.minSale
                    }).then(function() {
                        return getBalance(accounts[1]).then(balanceBefore => {
                            return crowdsale.refundSuspended(accounts[1]).then(function() {
                                return getBalance(accounts[1]).then(balanceAfter => {
                                    const expectedBalance = balanceBefore.add(constants.minSale);
                                    Assert.equal(balanceAfter.toString(), expectedBalance.toString());
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
            return crowdsale.setExchangeRate(1, constants.minSale).then(function() {
                return crowdsale.pauseCrowdsale().then(function() {
                    Assert.rejects(crowdsale.sendTransaction({
                        from: accounts[1],
                        value: constants.minSale
                    }), whenReverted)
                })
            })
        });
    })
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("External payment", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            const reference = "checksum";
            return crowdsale.processExternalPayment(accounts[1], constants.minSale, [1, constants.minSale], web3.utils.utf8ToHex(reference)).then(function(tx) {
                return CryptoPoliceOfficerToken.deployed().then(function(token) {
                    return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                        Assert.equal(tokenCount.toString(10), "1");
                        Assert.ok(tx.logs.length)
                        const event = tx.logs[0];
                        Assert.equal(event.event, "PaymentProcessed");
                        Assert.equal(event.args.participant, accounts[1])
                        Assert.equal(event.args.payment.weiAmount, constants.minSale.toString(10))
                        Assert.equal(event.args.payment.rate.tokens, "1")
                        Assert.equal(event.args.payment.rate.price, constants.minSale.toString(10))
                        Assert.equal(web3.utils.hexToUtf8(event.args.payment.externalPaymentReference), reference)
                        Assert.equal(event.args.tokens.toString(10), "1")
                        Assert.equal(event.args.unprocessablePaymentReminder.toString(10), "0")
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
                return crowdsale.setExchangeRate(1, constants.minSale).then(function() {
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
    describe("Refund after failed crowdsale", function() {
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
                return getBalance(accounts[2]).then(balnace2AfterTx => {
                    return crowdsale.refund(accounts[2]).then(function() {
                        return getBalance(accounts[2]).then(balance2AfterRefund => {
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
    it("Participant's balance unchanged after external payment has payment remainder", function() {
        return CryptoPoliceCrowdsale.deployed().then(crowdsale => {
            return getBalance(accounts[1]).then(balanceBefore => {
                return crowdsale.processExternalPayment(accounts[1], constants.minSale.add(new BN(1)), [1, constants.minSale], web3.utils.utf8ToHex("checksum")).then(tx => {
                    return getBalance(accounts[1]).then(balanceAfter => {
                        Assert.equal(balanceAfter.toString(), balanceBefore.toString())
                        Assert.ok(tx.logs.length)
                        const event = tx.logs[0];
                        Assert.equal(event.event, "PaymentProcessed");
                        Assert.equal(event.args.unprocessablePaymentReminder.toString(10), "1")
                    })
                })
            })
        })
    })
});
contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Suspended payment is not transfered to owner when crowdsale ended", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.setExchangeRate(1, constants.minSale).then(function() {
                return crowdsale.sendTransaction({
                    from: accounts[1],
                    value: constants.minSale
                }).then(function () {
                    return crowdsale.setCumulativePaymentLimitOfNonKycCompliantParticipant(constants.minSale.sub(new BN(1, 10))).then(() => {
                        return crowdsale.sendTransaction({
                            from: accounts[2],
                            value: constants.minSale
                        }).then(function () {
                            return getBalance(accounts[0]).then(balanceBefore => {
                                return crowdsale.endCrowdsale(true, { gasPrice: constants.gasPrice }).then(function(tx) {
                                    return getBalance(accounts[0]).then(balanceAfter => {
                                        const balanceExpected = balanceBefore.add(constants.minSale).sub(getTxCost(tx));
                                        Assert.equal(balanceAfter.toString(), balanceExpected.toString());
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

contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Set participant not KYC compliant", function() {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.setExchangeRate(1, constants.minSale).then(function() {
                return crowdsale.setCumulativePaymentLimitOfNonKycCompliantParticipant(constants.minSale.sub(new BN(1, 10))).then(() => {
                    return crowdsale.setParticipantIsKycCompliant(accounts[1]).then(() => {
                        return crowdsale.sendTransaction({
                            from: accounts[1],
                            value: constants.minSale
                        }).then(() => {
                            return crowdsale.setParticipantIsNotKycCompliant(accounts[1]).then(() => {
                                return crowdsale.setSuspendNonKycCompliantParticipantPayment(false).then(() => {
                                    Assert.rejects(crowdsale.sendTransaction({
                                        from: accounts[1],
                                        value: constants.minSale
                                    }), whenReverted)
                                })
                            })
                        })
                    })
                })
            })
        })
    })
});

contract('CryptoPoliceCrowdsale', accounts => {
    before(startCrowdsale);
    it("Ban and unban", () => {
        return CryptoPoliceCrowdsale.deployed().then(crowdsale => {
            return crowdsale.setExchangeRate(1, constants.minSale).then(() => {
                return crowdsale.ban(accounts[1]).then(() => {
                    return crowdsale.sendTransaction({
                        from: accounts[1],
                        value: constants.minSale
                    }).then(() => {
                        Assert.fail("Banned participant transaction should have been rejected")
                    }).catch(error => {
                        Assert.ok(error.message.includes("banned"))
                        return crowdsale.unban(accounts[1]).then(() => {
                            return crowdsale.sendTransaction({
                                from: accounts[1],
                                value: constants.minSale
                            })
                        })
                    })
                })
            })
        })
    })
})

contract('CryptoPoliceCrowdsale', function(accounts) {
    before(startCrowdsale);
    it("Suspended external payment is processed after participant is set as KYC compliant", function() {
        before(startCrowdsale);
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return crowdsale.setCumulativePaymentLimitOfNonKycCompliantParticipant(constants.minSale.sub(new BN(1))).then(() => {
                const reference = "checksum";
                return crowdsale.processExternalPayment(accounts[1], constants.minSale, [1, constants.minSale], web3.utils.utf8ToHex(reference)).then(function(tx) {
                    Assert.ok(tx.logs.length)
                    const event = tx.logs[0];
                    Assert.equal(event.event, "PaymentSuspended");
                    Assert.equal(event.args.participant, accounts[1])
                    Assert.equal(event.args.payment.weiAmount, constants.minSale.toString(10))
                    Assert.equal(event.args.payment.rate.tokens, "1")
                    Assert.equal(event.args.payment.rate.price, constants.minSale.toString(10))
                    Assert.equal(web3.utils.hexToUtf8(event.args.payment.externalPaymentReference), reference)
                    return CryptoPoliceOfficerToken.deployed().then(function(token) {
                        return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                            Assert.equal(tokenCount.toString(10), "0");
                            return crowdsale.setParticipantIsKycCompliant(accounts[1]).then(function() {
                                return token.balanceOf.call(accounts[1]).then(function(tokenCount) {
                                    Assert.equal(tokenCount.toString(10), "1");
                                })
                            })
                        })
                    })
                })
            })
        })
    });
});