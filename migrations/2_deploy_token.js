var CryptoPoliceOfficerToken = artifacts.require("CryptoPoliceOfficerToken");

module.exports = function(deployer, network) {
    if (network == "live") {
        deployer.deploy(CryptoPoliceOfficerToken, "OfficerCoin", "OFC");
    } else {
        deployer.deploy(CryptoPoliceOfficerToken, "CPTEST", "CPTEST");
    }
};