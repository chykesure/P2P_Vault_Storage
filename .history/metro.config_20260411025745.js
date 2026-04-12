const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: true,
  // Prioritize CommonJS / React Native to avoid ESM import.meta files
  unstable_conditionNames: ['require', 'react-native', 'browser', 'default'],
  sourceExts: [
    ...config.resolver.sourceExts,
    'mjs', 'cjs'
  ],
  blockList: [
    ...config.resolver.blockList || [],
    /@wagmi\/core\/node_modules\/zustand\/.*/,
    /@gemini-wallet\/core\/node_modules\/.*/,
  ],
};

module.exports = config;