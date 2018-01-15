module.exports = function StartCrowdsale(tokenContract, crowdsaleContract, adminAddress) {
    return tokenContract.then(function(token) {
        return crowdsaleContract.then(function(crowdsale) {
            return token.setCrowdsaleContract(crowdsale.address).then(function() {
                return crowdsale.startCrowdsale(token.address, adminAddress);
            });
        });
    });
}