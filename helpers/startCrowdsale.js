var CryptoPoliceOfficerToken = artifacts.require("CryptoPoliceOfficerToken");
var CryptoPoliceCrowdsale = artifacts.require("CryptoPoliceCrowdsale");

module.exports = function StartCrowdsale() {
    return CryptoPoliceOfficerToken.deployed().then(function(token) {
        return CryptoPoliceCrowdsale.deployed().then(function(crowdsale) {
            return token.transfer(crowdsale.address, "400000000000000000000000000").then(function(result) {
                return crowdsale.startCrowdsale(token.address);
            });
        });
    });
}