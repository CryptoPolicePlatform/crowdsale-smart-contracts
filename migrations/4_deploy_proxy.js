var CryptoPoliceProxy = artifacts.require("CryptoPoliceProxy");
var CryptoPoliceOfficerToken = artifacts.require("CryptoPoliceOfficerToken");

module.exports = function(deployer) {
    CryptoPoliceOfficerToken.deployed().then(function (token) {
        deployer.deploy(CryptoPoliceProxy, token.address);
    });
};