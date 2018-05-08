var CryptoPoliceProxy = artifacts.require("CryptoPoliceProxy");
var CryptoPoliceAirdrop = artifacts.require("CryptoPoliceAirdrop");

module.exports = function(deployer) {
    deployer.deploy(CryptoPoliceAirdrop, CryptoPoliceProxy.address);
};