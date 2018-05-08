var CryptoPoliceProxy = artifacts.require("CryptoPoliceProxy");
var CryptoPoliceOfficerToken = artifacts.require("CryptoPoliceOfficerToken");

module.exports = function(deployer) {
    deployer.deploy(CryptoPoliceProxy, CryptoPoliceOfficerToken.address);
};