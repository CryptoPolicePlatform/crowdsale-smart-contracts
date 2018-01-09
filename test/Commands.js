const gas = 800000;
const Assert = require('assert');
const CryptoPoliceCrowdsale = artifacts.require("CryptoPoliceCrowdsale");
const CryptoPoliceOfficerToken = artifacts.require("CryptoPoliceOfficerToken");
const { exec } = require('child_process');
const BigNumber = require('bignumber.js');

const runCommand = function (cmdName, params) {
    return new Promise((resolve, reject) => {
        CryptoPoliceOfficerToken.deployed().then(function (token) {
            CryptoPoliceCrowdsale.deployed().then(function (crowdsale) {
                crowdsale.owner.call().then(function (ownerAddress) {
                    let cmdParams = "";
                    if (params && params.length > 0) {
                        cmdParams += " " + params.join(' ');
                    }
                    const cmd = `truffle exec scripts/commands.js command ${cmdName}${cmdParams} --token=${token.address} --crowdsale=${crowdsale.address} --from=${ownerAddress} --gas=${gas}`;
                    exec(cmd, (error, stdout, stderr) => {
                        if (error) {
                            if (stdout) {
                                error = new Error(error + stdout.toString())
                            }
                            reject(error);
                        } else {
                            resolve();
                        }
                    })
                })
            })
        })
    })
};

contract("All", function (accounts) {
    describe("All", function () {
        it("Start crowdsale", function () {
            return runCommand("Start").then(function () {
                return CryptoPoliceCrowdsale.deployed().then(function (crowdsale) {
                    return crowdsale.state.call().then(function (state) {
                        Assert.equal(state.toString(), "1")
                    })
                })
            })
        });
        it("Pause crowdsale", function () {
            return runCommand("Pause").then(function () {
                return CryptoPoliceCrowdsale.deployed().then(function (crowdsale) {
                    return crowdsale.state.call().then(function (state) {
                        Assert.equal(state.toString(), "3")
                    })
                })
            })
        });
        it("Unpause crowdsale", function () {
            return runCommand("Unpause").then(function () {
                return CryptoPoliceCrowdsale.deployed().then(function (crowdsale) {
                    return crowdsale.state.call().then(function (state) {
                        Assert.equal(state.toString(), "1")
                    })
                })
            })
        });
        it("Lock tokens", function () {
            return runCommand("AddTokenLock", [1000, 0]).then(function () {
                return CryptoPoliceOfficerToken.deployed().then(function (token) {
                    return token.lockedAmount.call().then(function (amount) {
                        Assert.equal(amount.toString(), "1000");
                    })
                })
            })
        });
        it("Mark address identified", function () {
            return runCommand("MarkAddressIdentified", [accounts[1]]).then(function () {
                return CryptoPoliceCrowdsale.deployed().then(function (crowdsale) {
                    return crowdsale.identifiedAddresses.call(accounts[1]).then(function (result) {
                        Assert.ok(result)
                    })
                })
            })
        });
        it("Update exchange rate", function () {
            return runCommand("UpdateExchangeRate", [0, 2, 1]).then(function () {
                return CryptoPoliceCrowdsale.deployed().then(function (crowdsale) {
                    return crowdsale.exchangeRates.call(0).then(function (rate) {
                        Assert.equal(rate[0].toString(), "2");
                        Assert.equal(rate[1].toString(), "1");
                    })
                })
            })
        });
        it("Update max unidentified investment", function () {
            const newValue = new BigNumber("11e+18");
            return runCommand("UpdateMaxUnidentifiedInvestment", [newValue]).then(function () {
                return CryptoPoliceCrowdsale.deployed().then(function (crowdsale) {
                    return crowdsale.maxUnidentifiedInvestment.call().then(function (value) {
                        Assert.equal(value.toString(), newValue.toString());
                    })
                })
            })
        });
        it("Update min sale", function () {
            const newValue = new BigNumber("10e+18");
            return runCommand("UpdateMinSale", [newValue]).then(function () {
                return CryptoPoliceCrowdsale.deployed().then(function (crowdsale) {
                    return crowdsale.minSale.call().then(function (value) {
                        Assert.equal(value.toString(), newValue.toString());
                    })
                })
            })
        });
        it("Proxy exchange", function () {
            const amount = new BigNumber("10e+18");
            return runCommand("ProxyExchange", [accounts[2], amount]).then(function () {
                return CryptoPoliceCrowdsale.deployed().then(function (crowdsale) {
                    return crowdsale.weiSpent.call(accounts[2]).then(function (value) {
                        Assert.equal(value.toString(), amount.toString());
                    })
                })
            })
        });
        it("Return suspended funds", function () {
            const amount = new BigNumber("12e+18");
            return CryptoPoliceCrowdsale.deployed().then(function (crowdsale) {
                return crowdsale.sendTransaction({
                    from: accounts[3],
                    value: amount
                }).then(function () {
                    const balanceBefore = web3.eth.getBalance(accounts[3]);
                    return runCommand("ReturnSuspendedFunds", [accounts[3]]).then(function () {
                        const expected = balanceBefore.add(amount);
                        const balanceAfter = web3.eth.getBalance(accounts[3]);
                        Assert.equal(balanceAfter.toString(), expected);
                    })
                })
            });
        });
        it("Money back", function () {
            const amount = new BigNumber("10e+18");
            return CryptoPoliceCrowdsale.deployed().then(function (crowdsale) {
                return crowdsale.sendTransaction({
                    from: accounts[3],
                    value: amount
                }).then(function () {
                    const balanceBefore = web3.eth.getBalance(accounts[3]);
                    return runCommand("MoneyBack", [accounts[3]]).then(function () {
                        const balanceAfter = web3.eth.getBalance(accounts[3]);
                        const expected = balanceBefore.add(amount);
                        Assert.equal(balanceAfter.toString(), expected);
                    })
                })
            })
        });
        it("End crowdsale", function () {
            return runCommand("EndCrowdsale", [true]).then(function () {
                return CryptoPoliceCrowdsale.deployed().then(function (crowdsale) {
                    return crowdsale.state.call().then(function (value) {
                        Assert.equal(value.toString(), "2");
                    })
                })
            })
        });
        it("Enable public transfers", function () {
            return runCommand("EnablePublicTransfers").then(function () {
                return CryptoPoliceOfficerToken.deployed().then(function (token) {
                    return token.publicTransfersEnabled.call().then(function (value) {
                        Assert.ok(value);
                    })
                })
            })
        });
        it("Release locked tokens", function () {
            return runCommand("ReleaseLockedTokens", [0]).then(function () {
                return CryptoPoliceOfficerToken.deployed().then(function (token) {
                    return token.lockedAmount.call().then(function (amount) {
                        Assert.equal(amount, "0")
                    })
                })
            })
        });
        it("Burn leftover tokens", function () {
            return runCommand("BurnLeftoverTokens", [100]).then(function () {
                return CryptoPoliceCrowdsale.deployed().then(function (crowdsale) {
                    return CryptoPoliceOfficerToken.deployed().then(function (token) {
                        return token.balanceOf.call(crowdsale.address).then(function (amount) {
                            Assert.equal(amount.toString(), "0")
                        })
                    })
                })
            })
        });
    });
})