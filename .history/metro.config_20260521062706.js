const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep default Expo behavior (VERY IMPORTANT)
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
];

// Remove ALL Node polyfills (Expo handles this internally)
// ❌ DO NOT manually map crypto/fs/etc
config.resolver.extraNodeModules = undefined;

// Remove custom resolveRequest override if it exists
config.resolver.resolveRequest = undefined;

module.exports = config;