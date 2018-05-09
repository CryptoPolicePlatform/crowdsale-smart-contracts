module.exports = function StartCrowdsale(tokenContract, crowdsaleContract, adminAddress, proxyContract) {
    return tokenContract.then(function(token) {
        return crowdsaleContract.then(function(crowdsale) {
            return proxyContract.then(function (proxy) {
                return token.setCrowdsaleContract(proxy.address).then(function() {
                    return proxy.setCrowdsale(crowdsale.address).then(function () {
                        return crowdsale.startCrowdsale(proxy.address, adminAddress);
                    });
                });
            });
        });
    });
}