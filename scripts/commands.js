const contract = require("truffle-contract");
const crowdsaleMeta = require("../build/contracts/CryptoPoliceCrowdsale.json");
const tokenMeta = require("../build/contracts/CryptoPoliceOfficerToken.json");
const startCrowdsaleHelper = require('./../helpers/startCrowdsale');

const requiredOptions = [
    "from",     // Owner's address
    "token",    // Address of token contract
    "crowdsale" // Address of crowdsale contract
];

module.exports = function(callback) {
    const args = getArgs();
    const artifacts = initArtifacts(args);

    if (commands[args.cmd]) {
        commands[args.cmd](callback, artifacts, args.params);
    } else {
        callback(`Unknown command: ${args.cmd}`);
    }
}

function getArgs() {
    const args = process.argv;

    let parsed = {
        params: [],
        options: {}
    };

    const parseOptions = function (arg, options) {
        options.forEach(function(option) {
            const optDef = `--${option}=`;

            if (arg.startsWith(optDef)) {
                parsed.options[option] = arg.substr(optDef.length);
            }
        })
    }

    for (let i = 0; i < args.length; i++) {
        if (args[i] == "command") {
            parsed.cmd = args[i + 1];
            for (let j = i + 2 ; j < args.length; j++) {
                if (args[j].startsWith("-")) {
                    parseOptions(args[j], requiredOptions);
                } else {
                    parsed.params.push(args[j]);
                }
            }
            break;
        }
    }

    return parsed;
}

function initArtifacts(args) {
    crowdsaleMeta.address = args.options.crowdsale;
    const CryptoPoliceCrowdsale = contract(crowdsaleMeta);
    tokenMeta.address = args.options.token;
    const CryptoPoliceOfficerToken = contract(tokenMeta);

    CryptoPoliceCrowdsale.setProvider(web3.currentProvider);
    CryptoPoliceOfficerToken.setProvider(web3.currentProvider);

    CryptoPoliceCrowdsale.defaults({ from: args.options.from });
    CryptoPoliceOfficerToken.defaults({ from: args.options.from });

    return {
        get crowdsale() {
            return CryptoPoliceCrowdsale
        },
        get token() {
            return CryptoPoliceOfficerToken
        }
    }
}

const commands = {
    Start: function (callback, artifacts) {
        startCrowdsaleHelper(artifacts.token, artifacts.crowdsale).then(() => callback())
    },
    Pause: function (callback, artifacts) {
        artifacts.crowdsale.deployed().then(function(crowdsale) {
            crowdsale.pauseCrowdsale().then(() => callback())
        })
    },
    Unpause: function (callback, artifacts) {
        artifacts.crowdsale.deployed().then(function(crowdsale) {
            crowdsale.unPauseCrowdsale().then(() => callback())
        })
    },
    ProxyExchange: function (callback, artifacts, params) {
        artifacts.crowdsale.deployed().then(function(crowdsale) {
            crowdsale.proxyExchange(params[0], params[1]).then(() => callback())
        })
    },
    EndCrowdsale: function (callback, artifacts, params) {
        artifacts.crowdsale.deployed().then(function(crowdsale) {
            crowdsale.endCrowdsale(params[0] == "true" || params[0] == "1").then(() => callback())
        })
    },
    MarkAddressIdentified: function (callback, artifacts, params) {
        artifacts.crowdsale.deployed().then(function(crowdsale) {
            crowdsale.markAddressIdentified(params[0]).then(() => callback())
        })
    },
    ReturnSuspendedFunds: function (callback, artifacts, params) {
        artifacts.crowdsale.deployed().then(function(crowdsale) {
            crowdsale.returnSuspendedFunds(params[0]).then(() => callback())
        })
    },
    TransferCrowdsaleFunds: function (callback, artifacts, params) {
        artifacts.crowdsale.deployed().then(function(crowdsale) {
            crowdsale.transferFunds(params[0], params[1]).then(() => callback())
        })
    },
    UpdateMaxUnidentifiedInvestment: function (callback, artifacts, params) {
        artifacts.crowdsale.deployed().then(function(crowdsale) {
            crowdsale.updateMaxUnidentifiedInvestment(params[0]).then(() => callback())
        })
    },
    UpdateMinSale: function (callback, artifacts, params) {
        artifacts.crowdsale.deployed().then(function(crowdsale) {
            crowdsale.updateMinSale(params[0]).then(() => callback())
        })
    },
    BurnLeftoverTokens: function (callback, artifacts, params) {
        artifacts.crowdsale.deployed().then(function(crowdsale) {
            crowdsale.burnLeftoverTokens(params[0]).then(() => callback())
        })
    },
    UpdateExchangeRate: function (callback, artifacts, params) {
        artifacts.crowdsale.deployed().then(function(crowdsale) {
            crowdsale.updateExchangeRate(params[0], params[1], params[2]).then(() => callback())
        })
    },
    MoneyBack: function (callback, artifacts, params) {
        artifacts.crowdsale.deployed().then(function(crowdsale) {
            crowdsale.moneyBack(params[0]).then(() => callback())
        })
    },
    EnablePublicTransfers: function (callback, artifacts) {
        artifacts.token.deployed().then(function(token) {
            token.enablePublicTransfers().then(() => callback())
        })
    },
    AddTokenLock: function (callback, artifacts, params) {
        artifacts.token.deployed().then(function(token) {
            token.addTokenLock(params[0], params[1]).then(() => callback())
        })
    },
    ReleaseLockedTokens: function (callback, artifacts, params) {
        artifacts.token.deployed().then(function(token) {
            token.releaseLockedTokens(params[0]).then(() => callback())
        })
    }
};