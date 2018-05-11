module.exports = function (web3, callback, settings) {
    const meta = require("../build/contracts/" + settings.contractName + ".json");
    const contract = web3.eth.contract(meta.abi);
    const fs = require('fs');
    const args = (settings.args ? settings.args : []).concat([{
        data: meta.bytecode
    }]);
    const data = contract.new.getData.apply(null, args);
    const estimate = web3.eth.estimateGas({
        data: data
    });

    console.log("Gas estimate: " + estimate);
    
    fs.writeFile(process.argv[process.argv.length - 1], data, (error) => {
        if (error) {
            callback(error);
        } else {
            callback();
        }
    });
}