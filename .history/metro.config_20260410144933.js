const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Fix broken nested dependency resolution
config.resolver.resolveRequest = (context, moduleName, platform) => {

  // Fix 1: zod/mini — Metro can't resolve zod's subpath exports
  if (moduleName === 'zod/mini') {
    return context.resolveRequest(context, 'zod', platform);
  }

  // Fix 2: @metamask/rpc-errors — nested copy inside @gemini-wallet/core
  // is broken (missing dist/index.mjs). Force Metro to use the top-level
  // copy instead of the broken nested one.
  if (moduleName === '@metamask/rpc-errors') {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(__dirname, 'package.json') },
      moduleName,
      platform
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.sourceExts = [
  'expo.ts', 'expo.tsx', 'expo.js', 'expo.jsx',
  'ts', 'tsx', 'js', 'jsx', 'json', 'wasm',
];

module.exports = config;