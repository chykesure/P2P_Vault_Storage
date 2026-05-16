const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [
  'expo.ts', 'expo.tsx', 'expo.js', 'expo.jsx',
  'ts', 'tsx', 'js', 'jsx', 'json', 'wasm',
];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Block Node.js built-ins (node:crypto, etc.)
  if (moduleName.startsWith('node:')) {
    return { type: 'empty' };
  }

  // Fix zod/mini — porto imports this but the .cjs file doesn't exist in RN
  // Redirect to regular zod which works fine
  if (moduleName === 'zod/mini') {
    return context.resolveRequest(context, 'zod', platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;