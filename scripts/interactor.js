module.exports = function(callback) {
    const payload = JSON.parse(process.argv[process.argv.length - 1]);
    const Contract = artifacts.require(payload.contract.name);

    Contract.defaults(payload.transactionObject);
    
    Contract.deployed().then(contract => {
        contract[payload.exec.method].apply(null, payload.exec.args)
        .then(result => {
            console.log(JSON.stringify(result));
            callback()
        }).catch(e => {
            callback(e.message)
        })
    }).catch(e => {
        callback(e.message)
    })
}