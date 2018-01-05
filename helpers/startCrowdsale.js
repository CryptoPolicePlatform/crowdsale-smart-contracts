module.exports = function StartCrowdsale(tokenContract, crowdsaleContract) {
    return tokenContract.deployed().then(function(token) {
        return crowdsaleContract.deployed().then(function(crowdsale) {
            return token.setCrowdsaleContract(crowdsale.address).then(function() {
                return crowdsale.startCrowdsale(token.address);
            });
        });
    });
}