const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

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

  // zod/mini: nested copy from 'porto' has broken .cjs entry
  if (moduleName === 'zod/mini') {
    return context.resolveRequest(context, 'zod', platform);
  }

  // @metamask/rpc-errors: nested copy from @gemini-wallet/core has broken .cjs
  // Force to project root version which has proper .js files
  if (moduleName === '@metamask/rpc-errors') {
    try {
      const topDir = path.resolve(__dirname, 'node_modules/@metamask/rpc-errors');
      const pkg = require(path.join(topDir, 'package.json'));
      const mainFile = (pkg.main || 'index.js').replace(/\.cjs$/, '.js');
      return { type: 'sourceFile', filePath: path.resolve(topDir, mainFile) };
    } catch (e) {}
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;