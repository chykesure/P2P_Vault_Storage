const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Better handling for modern packages with broken "exports"
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: true,   // Important for @metamask/* and others
  sourceExts: [
    ...config.resolver.sourceExts,
    'mjs', 'cjs', 'json'
  ],
  // Optional: block deeply nested problematic copies
  blockList: [
    ...config.resolver.blockList || [],
    /@gemini-wallet\/core\/node_modules\/.*/,
    /@wagmi\/core\/node_modules\/zustand\/.*/,
  ],
};

module.exports = config;