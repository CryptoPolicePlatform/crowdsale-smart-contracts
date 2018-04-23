const tokenMeta = require("../build/contracts/CryptoPoliceOfficerToken.json");
const CryptoPoliceOfficerToken = web3.eth.contract(tokenMeta.abi);
const fs = require('fs');

module.exports = function(callback) {
    var data = CryptoPoliceOfficerToken.new.getData("OfficerCoin", "OFCR", {
        data: tokenMeta.bytecode
    });
    fs.writeFile(process.argv[process.argv.length - 1], data, (error) => {
        if (error) {
            callback(error);
        } else {
            callback();
        }
    }); 
}