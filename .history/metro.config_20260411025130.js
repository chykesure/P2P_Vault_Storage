const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: true,
  // Prioritize CommonJS / React Native builds over ESM (avoids import.meta)
  unstable_conditionNames: ['require', 'react-native', 'browser', 'default'],
  sourceExts: [
    ...config.resolver.sourceExts,
    'mjs', 'cjs'
  ],
  // Block deeply nested broken zustand copies
  blockList: [
    ...config.resolver.blockList || [],
    /@wagmi\/core\/node_modules\/zustand\/.*/,
    /@gemini-wallet\/core\/node_modules\/.*/,
  ],
};

module.exports = config;