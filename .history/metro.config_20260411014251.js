const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Force ALL @metamask/rpc-errors imports to use the top-level package
// This overrides broken nested copies inside @gemini-wallet/core
config.resolver.extraNodeModules = {
  '@metamask/rpc-errors': path.resolve(__dirname, 'node_modules/@metamask/rpc-errors'),
};

// Fix zod/mini — Metro can't resolve zod's subpath exports
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'zod/mini') {
    return context.resolveRequest(context, 'zod', platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.sourceExts = [
  'expo.ts', 'expo.tsx', 'expo.js', 'expo.jsx',
  'ts', 'tsx', 'js', 'jsx', 'json', 'wasm',
];

module.exports = config;