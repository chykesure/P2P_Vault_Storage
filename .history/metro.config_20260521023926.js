const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * Extend default Expo source extensions safely
 * (DO NOT overwrite defaults)
 */
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'cjs',
];

/**
 * Keep default asset extensions (important for Expo)
 * DO NOT override assetExts unless necessary
 */
config.resolver.assetExts = [
  ...config.resolver.assetExts,
];

/**
 * IMPORTANT:
 * Do NOT add custom extraNodeModules or resolveRequest hacks
 * Expo already handles:
 * - crypto
 * - stream
 * - buffer
 * - process
 * - zod resolution
 * - React Native polyfills
 */

module.exports = config;