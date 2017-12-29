const BigNumber = require('bignumber.js');
GLOBAL.minCap = new BigNumber("12500000e+18");
GLOBAL.softCap = new BigNumber("40000000e+18");
GLOBAL.powerCap = new BigNumber("160000000e+18");
GLOBAL.hardCap = new BigNumber("400000000e+18");
GLOBAL.minSale = new BigNumber("1e+16");
GLOBAL.gasPrice = 10000000000;
GLOBAL.maxUnidentifiedInvestment = minSale.add(1);