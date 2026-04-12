const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {

  // Fix zod/mini
  if (moduleName === 'zod/mini') {
    return context.resolveRequest(context, 'zod', platform);
  }

  // Fix ox package: .ts files import .js but only .ts files exist
  // This converts ../core/AbiParameters.js → ../core/AbiParameters.ts
  if (moduleName.startsWith('.') && context.originModulePath) {
    const originPath = context.originModulePath.replace(/\\/g, '/');
    if (originPath.includes('node_modules/ox/')) {
      if (moduleName.endsWith('.js')) {
        const tsName = moduleName.slice(0, -3) + '.ts';
        try {
          return context.resolveRequest(context, tsName, platform);
        } catch (e) {
          // fall through
        }
      }
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.sourceExts = [
  'expo.ts', 'expo.tsx', 'expo.js', 'expo.jsx',
  'ts', 'tsx', 'js', 'jsx', 'json', 'wasm',
];

module.exports = config;