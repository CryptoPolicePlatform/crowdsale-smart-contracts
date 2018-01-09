module.exports = function StartCrowdsale(tokenContract, crowdsaleContract) {
    return tokenContract.then(function(token) {
        return crowdsaleContract.then(function(crowdsale) {
            return token.setCrowdsaleContract(crowdsale.address).then(function() {
                return crowdsale.startCrowdsale(token.address);
            });
        });
    });
}