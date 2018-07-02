module.exports = function(callback) {
    const payload = JSON.parse(process.argv[process.argv.length - 1]);
    const Contract = artifacts.require(payload.contract.name);
    
    Contract.defaults(payload.transactionObject);
    
    const events = Contract.at(payload.transactionObject.to).allEvents(payload.filter);

    events.get((error, logs) => {
        if (error) {
            callback(error)
        } else {
            console.log(JSON.stringify(logs));
        }
    });

    events.stopWatching();

    callback();
}