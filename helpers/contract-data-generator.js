module.exports = (contractName) => {
    const fs = require('fs');
    const meta = require("../build/contracts/" + contractName + ".json");
    const path = process.argv[process.argv.length - 1] + "/" + contractName

    console.log("Name: " + contractName);

    const bytecodeFilePathname = path + ".bytecode.dat"
    fs.writeFile(bytecodeFilePathname, meta.bytecode, (error) => {
        if(error) throw error
        console.log("Bytecode file pathname: " + bytecodeFilePathname);
    });

    const abiFilePathname = path + ".abi.json";
    fs.writeFile(abiFilePathname, JSON.stringify(meta.abi), (error) => {
        if (error) throw error
        console.log("ABI file pathname: " + abiFilePathname);
    });
}