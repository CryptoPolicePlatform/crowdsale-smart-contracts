var CrowdsaleAdminWrapper = artifacts.require("CrowdsaleAdminWrapper");

module.exports = function(deployer) {
    deployer.deploy(CrowdsaleAdminWrapper);
};