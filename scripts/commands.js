const contract = require("truffle-contract");
const crowdsaleMeta = require("../build/contracts/CryptoPoliceCrowdsale.json");
const tokenMeta = require("../build/contracts/CryptoPoliceOfficerToken.json");
const startCrowdsaleHelper = require('./../helpers/startCrowdsale');

const requiredOptions = [
    "from",         // Owner's address
    "token",        // Address of token contract
    "crowdsale",    // Address of crowdsale contract
    "gas"
];

module.exports = function(callback) {
    const args = getArgs();
    const artifacts = initArtifacts(args);

    if (commands[args.cmd]) {
        commands[args.cmd](callback, artifacts, args.params)
            .then(() => callback())
            .catch(e => callback(e))
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
    const CryptoPoliceCrowdsale = contract(crowdsaleMeta);
    const CryptoPoliceOfficerToken = contract(tokenMeta);

    CryptoPoliceCrowdsale.setProvider(web3.currentProvider);
    CryptoPoliceOfficerToken.setProvider(web3.currentProvider);

    CryptoPoliceCrowdsale.defaults({ from: args.options.from, gas: args.options.gas });
    CryptoPoliceOfficerToken.defaults({ from: args.options.from, gas: args.options.gas });

    return {
        get crowdsale() {
            return CryptoPoliceCrowdsale.at(args.options.crowdsale)
        },
        get token() {
            return CryptoPoliceOfficerToken.at(args.options.token)
        }
    }
}

const commands = {
    Start: function (callback, artifacts, params) {
        return startCrowdsaleHelper(artifacts.token, artifacts.crowdsale, params[0])
    },
    Pause: function (callback, artifacts) {
        return artifacts.crowdsale.then(function(crowdsale) {
            return crowdsale.pauseCrowdsale()
        })
    },
    Unpause: function (callback, artifacts) {
        return artifacts.crowdsale.then(function(crowdsale) {
            return crowdsale.unPauseCrowdsale()
        })
    },
    ProxyExchange: function (callback, artifacts, params) {
        return artifacts.crowdsale.then(function(crowdsale) {
            return crowdsale.proxyExchange(params[0], params[1], params[2], params[3])
        })
    },
    EndCrowdsale: function (callback, artifacts, params) {
        return artifacts.crowdsale.then(function(crowdsale) {
            return crowdsale.endCrowdsale(params[0] == "true" || params[0] == "1")
        })
    },
    MarkAddressIdentified: function (callback, artifacts, params) {
        return artifacts.crowdsale.then(function(crowdsale) {
            return crowdsale.markAddressIdentified(params[0])
        })
    },
    ReturnSuspendedFunds: function (callback, artifacts, params) {
        return artifacts.crowdsale.then(function(crowdsale) {
            return crowdsale.returnSuspendedFunds(params[0])
        })
    },
    UpdateMaxUnidentifiedAmount: function (callback, artifacts, params) {
        return artifacts.crowdsale.then(function(crowdsale) {
            return crowdsale.updatemaxUnidentifiedAmount(params[0])
        })
    },
    UpdateMinSale: function (callback, artifacts, params) {
        return artifacts.crowdsale.then(function(crowdsale) {
            return crowdsale.updateMinSale(params[0])
        })
    },
    BurnLeftoverTokens: function (callback, artifacts, params) {
        return artifacts.crowdsale.then(function(crowdsale) {
            return crowdsale.burnLeftoverTokens(params[0])
        })
    },
    UpdateExchangeRate: function (callback, artifacts, params) {
        return artifacts.crowdsale.then(function(crowdsale) {
            return crowdsale.updateExchangeRate(params[0], params[1], params[2])
        })
    },
    MoneyBack: function (callback, artifacts, params) {
        return artifacts.crowdsale.then(function(crowdsale) {
            return crowdsale.moneyBack(params[0])
        })
    },
    EnablePublicTransfers: function (callback, artifacts) {
        return artifacts.token.then(function(token) {
            return token.enablePublicTransfers()
        })
    },
    AddTokenLock: function (callback, artifacts, params) {
        return artifacts.token.then(function(token) {
            return token.addTokenLock(params[0], params[1])
        })
    },
    ReleaseLockedTokens: function (callback, artifacts, params) {
        return artifacts.token.then(function(token) {
            return token.releaseLockedTokens(params[0])
        })
    },
    Refund: function (callback, artifacts, params) {
        return artifacts.crowdsale.then(function(crowdsale) {
            return crowdsale.refund(params[0])
        })
    }
};