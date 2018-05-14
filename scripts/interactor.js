const truffleContract = require("truffle-contract");

module.exports = function(callback) {
    const payload = JSON.parse(process.argv[process.argv.length - 1]);
    const Contract = artifacts.require(payload.contract.name);
    const contract = Contract.at(payload.contract.address);
    const method = contract[payload.exec.method];

    Contract.defaults(payload.transactionObject);

    method.apply(null, payload.exec.args).then(result => {
        console.log(JSON.stringify(result));
        callback()
    }).catch(e => {
        callback(e.message)
    })
}