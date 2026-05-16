const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [
  'expo.ts', 'expo.tsx', 'expo.js', 'expo.jsx',
  'ts', 'tsx', 'js', 'jsx', 'json', 'wasm',
];

// Force ALL package resolution from root node_modules ONLY.
// This prevents nested broken copies (inside @gemini-wallet, porto, @coinbase, etc.)
// from shadowing the working root versions.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Block Node.js built-ins (node:crypto, node:stream, etc.)
  if (moduleName.startsWith('node:')) {
    return { type: 'empty' };
  }

  // zod/mini from 'porto' — redirect to root zod
  if (moduleName === 'zod/mini') {
    return context.resolveRequest(context, 'zod', platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;