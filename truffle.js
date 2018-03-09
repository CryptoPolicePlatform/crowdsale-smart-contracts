module.exports = {
  networks: {
    // matches client started with "truffle develop" command
    development: {
      host: "localhost",
      port: 9545,
      network_id: "*"
    },
    rinkeby: {
      host: "localhost",
      port: 8545,
      network_id: 4
    }
  }
};
