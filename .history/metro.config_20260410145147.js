const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {

  // Fix: @metamask/rpc-errors — broken nested copy inside @gemini-wallet/core
  // Bypass Metro entirely and resolve from project root using Node.js
  if (moduleName === '@metamask/rpc-errors') {
    try {
      const resolvedPath = require.resolve('@metamask/rpc-errors', {
        paths: [path.resolve(__dirname)],
      });
      return { type: 'sourceFile', filePath: resolvedPath };
    } catch (e) {
      // fallback
    }
  }

  // Fix: zod/mini — Metro can't resolve zod's subpath exports
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