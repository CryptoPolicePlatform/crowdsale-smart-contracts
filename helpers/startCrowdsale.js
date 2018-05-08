module.exports = function StartCrowdsale(tokenContract, crowdsaleContract, adminAddress, proxyContract) {
    return tokenContract.then(function(token) {
        return crowdsaleContract.then(function(crowdsale) {
            return token.setCrowdsaleContract(crowdsale.address).then(function() {
                if (proxyContract) {
                    return proxyContract.then(function (proxy) {
                        return crowdsale.startCrowdsale(proxy.address, adminAddress);
                    })
                }
                return crowdsale.startCrowdsale(token.address, adminAddress);
            });
        });
    });
}