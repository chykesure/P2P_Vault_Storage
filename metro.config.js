const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Block porto - incompatible zod dependencies
  if (moduleName === 'porto') {
    return { type: 'sourceFile', filePath: path.resolve(__dirname, 'src/shims/empty.js') };
  }

  // Block mipd - browser wallet detection, crashes in React Native (uses window.addEventListener)
  if (moduleName === 'mipd') {
    return { type: 'sourceFile', filePath: path.resolve(__dirname, 'src/shims/mipd.js') };
  }

  // Fix ox: .ts files import .js but only .ts exist
  if (moduleName.startsWith('.') && context.originModulePath) {
    var p = context.originModulePath.replace(/\\/g, '/');
    if (p.includes('node_modules/ox/') && moduleName.endsWith('.js')) {
      try { return context.resolveRequest(context, moduleName.slice(0,-3) + '.ts', platform); } catch(e) {}
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.sourceExts = [
  'expo.ts', 'expo.tsx', 'expo.js', 'expo.jsx',
  'ts', 'tsx', 'js', 'jsx', 'json', 'wasm', 'cjs',
];

module.exports = config;