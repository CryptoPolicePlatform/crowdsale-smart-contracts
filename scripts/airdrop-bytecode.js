const generator = require("../helpers/gen-deploy-bytecode");
module.exports = function(callback) {
    generator(web3, callback, {
        contractName: "CryptoPoliceAirdrop",
        args: [process.argv[process.argv.length - 2]]
    });
}