var CryptoPoliceCrowdsale = artifacts.require("CryptoPoliceCrowdsale");

module.exports = function(deployer) {
    deployer.deploy(CryptoPoliceCrowdsale);
};