
class Config {
  constructor(proxyType) {
    this.proxyType = proxyType || '';
  }
}

Config.prototype.brokerUrl = 'snowflake-broker.freehaven.net';

Config.prototype.relayAddr = {
  host: 'snowflake.freehaven.net',
  port: '443'
};

// Original non-wss relay:
// host: '192.81.135.242'
// port: 9902
Config.prototype.cookieName = "snowflake-allow";

// Bytes per second. Set to undefined to disable limit.
Config.prototype.rateLimitBytes = void 0;

Config.prototype.minRateLimit = 10 * 1024;

Config.prototype.rateLimitHistory = 5.0;

Config.prototype.defaultBrokerPollInterval = 60.0 * 1000; //1 poll every minutes
Config.prototype.slowestBrokerPollInterval = 6 * 60 * 60.0 * 1000; //1 poll every 6 hours
Config.prototype.pollAdjustment = 100.0 * 1000;

// Recheck our NAT type once every 2 days
Config.prototype.natCheckInterval = 2 * 24 * 60 * 60 * 1000;

// Timeout after sending answer before datachannel is opened
Config.prototype.datachannelTimeout = 20 * 1000;

// Timeout to close proxypair if no messages are sent
Config.prototype.messageTimeout = 30 * 1000;

Config.prototype.maxNumClients = 1;

Config.prototype.proxyType = "";

// TODO: Different ICE servers.
Config.prototype.pcConfig = {
  iceServers: [
    {
      urls: ['stun:stun.l.google.com:19302']
    }
  ]
};

Config.PROBEURL = "https://snowflake-broker.freehaven.net:8443/probe";
