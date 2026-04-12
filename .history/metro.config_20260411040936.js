const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {

  // Fix zod/mini
  if (moduleName === 'zod/mini') {
    return context.resolveRequest(context, 'zod', platform);
  }

  // Fix ox package: TypeScript source files import .js but only .ts files exist
  // When resolving relative imports inside ox, try .ts extension instead of .js
  if (moduleName.startsWith('.') && context.originModulePath) {
    const origin = context.originModulePath.replace(/\//g, path.sep);
    if (origin.includes(path.join('node_modules', 'ox') + path.sep)) {
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