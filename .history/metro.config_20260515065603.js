const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure .sol files aren't processed
config.resolver.sourceExts = [
  'expo.ts',
  'expo.tsx',
  'expo.js',
  'expo.jsx',
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'wasm',
];

// Resolve Node.js built-in modules to empty shims for React Native
// These are imported by @metamask/sdk and other web3 packages but don't exist in RN
const emptyModule = path.resolve(__dirname, 'shims/emptyModule.js');
const nodeBuiltins = [
  'node:crypto',
  'node:stream',
  'node:http',
  'node:https',
  'node:zlib',
  'node:url',
  'node:util',
  'node:buffer',
  'node:process',
  'node:os',
  'node:path',
  'node:fs',
  'crypto',
  'stream',
  'http',
  'https',
  'zlib',
  'url',
  'util',
  'os',
  'fs',
];

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect Node.js built-in modules to empty shim
  if (nodeBuiltins.includes(moduleName)) {
    return { type: 'sourceFile', filePath: emptyModule };
  }

  // Also handle 'node:xxx' pattern dynamically
  if (moduleName.startsWith('node:')) {
    return { type: 'sourceFile', filePath: emptyModule };
  }

  // Fall back to original resolver for everything else
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;