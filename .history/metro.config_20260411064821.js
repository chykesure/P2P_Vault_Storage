const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Fix ox: .ts files import .js but only .ts exist
  if (moduleName.startsWith('.') && context.originModulePath) {
    var p = context.originModulePath.replace(/\\/g, '/');
    if (p.includes('node_modules/ox/') && moduleName.endsWith('.js')) {
      try { return context.resolveRequest(context, moduleName.slice(0,-3) + '.ts', platform); } catch(e) {}
    }
  }
  // Fix zod subpaths: porto imports from "zod/v4" which doesn't exist in zod v3
  if (moduleName.startsWith('zod/')) {
    return context.resolveRequest(context, 'zod', platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.sourceExts = [
  'expo.ts', 'expo.tsx', 'expo.js', 'expo.jsx',
  'ts', 'tsx', 'js', 'jsx', 'json', 'wasm', 'cjs',
];

module.exports = config;