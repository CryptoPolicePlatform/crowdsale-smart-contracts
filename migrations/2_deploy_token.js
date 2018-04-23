var CryptoPoliceOfficerToken = artifacts.require("CryptoPoliceOfficerToken");

module.exports = function(deployer, network) {
    if (network == "live") {
        deployer.deploy(CryptoPoliceOfficerToken, "OfficerCoin", "OFCR");
    } else {
        deployer.deploy(CryptoPoliceOfficerToken, "CPTEST", "CPTEST");
    }
};