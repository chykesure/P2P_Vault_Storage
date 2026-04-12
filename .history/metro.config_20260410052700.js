const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix: Metro can't resolve package subpath exports like "zod/mini"
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'zod/mini') {
    return context.resolveRequest(context, 'zod', platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.sourceExts = ['expo.ts', 'expo.tsx', 'expo.js', 'expo.jsx', 'ts', 'tsx', 'js', 'jsx', 'json', 'wasm'];

module.exports = config;