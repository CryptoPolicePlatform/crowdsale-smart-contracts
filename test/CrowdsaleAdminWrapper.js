const CryptoPoliceCrowdsale = artifacts.require("CryptoPoliceCrowdsale");
const CrowdsaleAdminWrapper = artifacts.require("CrowdsaleAdminWrapper");
const Assert = require('assert');

contract('CrowdsaleAdminWrapper', accounts =>  {
    it("Admin can update prices", () => {
        return CrowdsaleAdminWrapper.deployed().then(wrapper => {
            return CryptoPoliceCrowdsale.deployed().then(crowdsale => {
                return crowdsale.setAdmin(wrapper.address).then(() => {
                    return wrapper.setCrowdsale(crowdsale.address).then(() => {
                        return wrapper.updatePrices(100, 101, [1, 2, 3, 4], [4, 3, 2, 1]).then(() => {
                            return crowdsale.minSale.call().then(minSale => {
                                Assert.equal(minSale.toString(), 100);
                                return crowdsale.unidentifiedSaleLimit.call().then(unidentifiedSaleLimit => {
                                    Assert.equal(unidentifiedSaleLimit.toString(), 101);
                                    return crowdsale.exchangeRates.call(0).then(rate0 => {
                                        Assert.equal(rate0[0].toString(), 4);
                                        Assert.equal(rate0[1].toString(), 1);
                                        return crowdsale.exchangeRates.call(1)
                                    }).then(rate1 => {
                                        Assert.equal(rate1[0].toString(), 3);
                                        Assert.equal(rate1[1].toString(), 2);
                                        return crowdsale.exchangeRates.call(2)
                                    }).then(rate2 => {
                                        Assert.equal(rate2[0].toString(), 2);
                                        Assert.equal(rate2[1].toString(), 3);
                                        return crowdsale.exchangeRates.call(3)
                                    }).then(rate3 => {
                                        Assert.equal(rate3[0].toString(), 1);
                                        Assert.equal(rate3[1].toString(), 4);
                                    })
                                })
                            })
                        })
                    })
                })
            })
        })
    })
})