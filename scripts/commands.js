const contract = require("truffle-contract");
const crowdsaleMeta = require("../build/contracts/CryptoPoliceCrowdsale.json");
const tokenMeta = require("../build/contracts/CryptoPoliceOfficerToken.json");
const startCrowdsaleHelper = require('./../helpers/startCrowdsale');

module.exports = function(callback) {
    const args = getArgs();
    const artifacts = initArtifacts(args);

    switch (args.cmd) {
        case "start":
            cmd_Start(callback, artifacts);
            break;
        case "pause":
            cmd_Pause(callback, artifacts);
            break;
        case "unpause":
            cmd_Unpause(callback, artifacts);
            break;
        default: callback(`Unknown command: ${args.cmd}`);
    }
}

function cmd_Start(callback, artifacts) {
    startCrowdsaleHelper(artifacts.token, artifacts.crowdsale).then(() => callback())
}

function cmd_Pause(callback, artifacts) {
    artifacts.crowdsale.deployed().then(function(crowdsale) {
        crowdsale.pauseCrowdsale().then(() => callback())
    })
}

function cmd_Unpause(callback, artifacts) {
    artifacts.crowdsale.deployed().then(function(crowdsale) {
        crowdsale.unPauseCrowdsale().then(() => callback())
    })
}

function cmd_ProxyExchange(callback, artifacts, params) {
    artifacts.crowdsale.deployed().then(function(crowdsale) {
        crowdsale.proxyExchange(params[0], params[1]).then(() => callback())
    })
}

function cmd_EndCrowdsale(callback, artifacts, params) {
    artifacts.crowdsale.deployed().then(function(crowdsale) {
        crowdsale.endCrowdsale(params[0] == "true" || params[0] == "1").then(() => callback())
    })
}

function cmd_MarkAddressIdentified(callback, artifacts, params) {
    artifacts.crowdsale.deployed().then(function(crowdsale) {
        crowdsale.markAddressIdentified(params[0]).then(() => callback())
    })
}

function cmd_ReturnSuspendedFunds(callback, artifacts, params) {
    artifacts.crowdsale.deployed().then(function(crowdsale) {
        crowdsale.returnSuspendedFunds(params[0]).then(() => callback())
    })
}

function cmd_TransferCrowdsaleFunds(callback, artifacts, params) {
    artifacts.crowdsale.deployed().then(function(crowdsale) {
        crowdsale.transferFunds(params[0], params[1]).then(() => callback())
    })
}

function cmd_UpdateMaxUnidentifiedInvestment(callback, artifacts, params) {
    artifacts.crowdsale.deployed().then(function(crowdsale) {
        crowdsale.updateMaxUnidentifiedInvestment(params[0]).then(() => callback())
    })
}

function cmd_UpdateMinSale(callback, artifacts, params) {
    artifacts.crowdsale.deployed().then(function(crowdsale) {
        crowdsale.updateMinSale(params[0]).then(() => callback())
    })
}

function cmd_BurnLeftoverTokens(callback, artifacts, params) {
    artifacts.crowdsale.deployed().then(function(crowdsale) {
        crowdsale.burnLeftoverTokens(params[0]).then(() => callback())
    })
}

function cmd_UpdateExchangeRate(callback, artifacts, params) {
    artifacts.crowdsale.deployed().then(function(crowdsale) {
        crowdsale.updateExchangeRate(params[0], params[1], params[2]).then(() => callback())
    })
}

function cmd_MoneyBack(callback, artifacts, params) {
    artifacts.crowdsale.deployed().then(function(crowdsale) {
        crowdsale.moneyBack(params[0]).then(() => callback())
    })
}

function cmd_EnablePublicTransfers(callback, artifacts) {
    artifacts.token.deployed().then(function(token) {
        token.enablePublicTransfers().then(() => callback())
    })
}

function cmd_AddTokenLock(callback, artifacts, params) {
    artifacts.token.deployed().then(function(token) {
        token.addTokenLock(params[0], params[1]).then(() => callback())
    })
}

function cmd_ReleaseLockedTokens(callback, artifacts, params) {
    artifacts.token.deployed().then(function(token) {
        token.releaseLockedTokens(params[0]).then(() => callback())
    })
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
                    parseOptions(args[j], ["from", "token", "crowdsale"]);
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