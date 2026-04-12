const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: true,
  unstable_conditionNames: ['require', 'react-native', 'browser', 'default'],
  sourceExts: [
    ...config.resolver.sourceExts,
    'mjs', 'cjs', 'ts', 'tsx'
  ],
  // Force Metro to resolve .js imports to .ts files in ox (this is the key fix)
  resolveRequest: (context, moduleName, platform) => {
    // Handle ox internal .js → .ts resolution
    if (moduleName.endsWith('.js') && moduleName.includes('ox/')) {
      const tsVersion = moduleName.replace(/\.js$/, '.ts');
      try {
        return context.resolveRequest(context, tsVersion, platform);
      } catch (e) {
        // fallback
      }
    }
    return context.resolveRequest(context, moduleName, platform);
  },
  blockList: [
    ...config.resolver.blockList || [],
    /@wagmi\/core\/node_modules\/zustand\/.*/,
    /porto\/node_modules\/ox\/.*\.mjs$/,
  ],
};

module.exports = config;