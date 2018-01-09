const CryptoPoliceCrowdsale = artifacts.require("CryptoPoliceCrowdsale");
const CryptoPoliceOfficerToken = artifacts.require("CryptoPoliceOfficerToken");
const Assert = require('assert');

const { exec } = require('child_process');

const runCommand = function (cmdName, params) {
    return new Promise((resolve, reject) => {
        CryptoPoliceOfficerToken.deployed().then(function (token) {
            CryptoPoliceCrowdsale.deployed().then(function (crowdsale) {
                crowdsale.owner.call().then(function (ownerAddress) {
                    const cmdParams = "";
                    const cmd = `truffle exec scripts/commands.js command ${cmdName}${cmdParams} --token=${token.address} --crowdsale=${crowdsale.address} --from=${ownerAddress}`;
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
                    return crowdsale.state().then(function (state) {
                        Assert.equal(state.toString(), "1")
                    })
                })
            })
        })
    });
})