const BigNumber = require('bignumber.js');
global.minCap = new BigNumber("12500000e+18");
global.softCap = new BigNumber("40000000e+18");
global.powerCap = new BigNumber("160000000e+18");
global.hardCap = new BigNumber("400000000e+18");
global.minSale = new BigNumber("1e+16");
global.gasPrice = 10000000000;
global.maxUnidentifiedInvestment = minSale.add(1);