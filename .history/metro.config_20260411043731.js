const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Fix ox: TypeScript files import .js but only .ts files exist
  if (moduleName.startsWith('.') && context.originModulePath) {
    var p = context.originModulePath.replace(/\\/g, '/');
    if (p.includes('node_modules/ox/') && moduleName.endsWith('.js')) {
      try { return context.resolveRequest(context, moduleName.slice(0,-3) + '.ts', platform); } catch(e) {}
    }
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