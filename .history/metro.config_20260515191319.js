const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  crypto: require.resolve('expo-crypto'),
  buffer: require.resolve('buffer'),
  process: require.resolve('process'),
};

module.exports = config;