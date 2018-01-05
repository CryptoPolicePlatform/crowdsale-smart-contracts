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
        default: callback(`Unknown command: ${args.cmd}`);
    }
}

function cmd_Start(callback, artifacts) {
    startCrowdsaleHelper(artifacts.token, artifacts.crowdsale).then(() => callback())
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