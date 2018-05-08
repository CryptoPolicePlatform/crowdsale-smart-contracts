module.exports = function StartCrowdsale(tokenContract, crowdsaleContract, adminAddress, proxyContract) {
    return tokenContract.then(function(token) {
        return crowdsaleContract.then(function(crowdsale) {
            if (proxyContract) {
                return proxyContract.then(function (proxy) {
                    return token.setCrowdsaleContract(proxy.address).then(function() {
                        return proxy.setCrowdsale(crowdsale.address).then(function () {
                            return crowdsale.startCrowdsale(proxy.address, adminAddress);
                        });
                    });
                })
            }
            
            return token.setCrowdsaleContract(crowdsale.address).then(function() {
                return crowdsale.startCrowdsale(token.address, adminAddress);
            });
        });
    });
}