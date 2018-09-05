module.exports = function(callback) {
    const payload = JSON.parse(process.argv[process.argv.length - 1]);
    const Contract = artifacts.require(payload.contract.name);
    
    delete payload.transactionObject.gasPrice;

    Contract.defaults(payload.transactionObject);
    
    Contract.at(payload.transactionObject.to).then(contract => {
        var method = contract[payload.exec.method];

        if (payload.readOnly) {
            method = method.call;
        }

        method.apply(null, payload.exec.args)
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