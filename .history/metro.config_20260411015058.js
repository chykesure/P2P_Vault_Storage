const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {

  // NUCLEAR FIX: Force @metamask/rpc-errors to the top-level working copy
  // This completely bypasses Metro's resolution — no nested lookup at all
  if (moduleName === '@metamask/rpc-errors') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'node_modules/@metamask/rpc-errors/dist/index.js'),
    };
  }

  // Fix zod/mini
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