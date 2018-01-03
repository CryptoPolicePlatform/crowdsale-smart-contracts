var CryptoPoliceOfficerToken = artifacts.require("CryptoPoliceOfficerToken");
var CryptoPoliceCrowdsale = artifacts.require("CryptoPoliceCrowdsale");
require('./constants');

module.exports = function StartCrowdsale() {
    return CryptoPoliceOfficerToken.deployed().then(function(token) {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return token.setCrowdsaleContract(crowdsale.address).then(function() {
                return token.transfer(crowdsale.address, hardCap).then(function(result) {
                    return crowdsale.startCrowdsale(token.address);
                });
            });
        });
    });
}