const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure .sol files aren't processed
config.resolver.sourceExts = [
  'expo.ts',
  'expo.tsx',
  'expo.js',
  'expo.jsx',
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'wasm',
];

// Empty shim for Node.js built-ins not available in React Native
// These are imported by @metamask/sdk, ethers, and other web3 packages
const emptyModule = path.resolve(__dirname, 'shims/emptyModule.js');

// Approach 1: extraNodeModules — simple string-to-path mapping
config.resolver.extraNodeModules = {
  crypto: emptyModule,
  stream: emptyModule,
  http: emptyModule,
  https: emptyModule,
  zlib: emptyModule,
  url: emptyModule,
  util: emptyModule,
  buffer: emptyModule,
  process: emptyModule,
  os: emptyModule,
  path: emptyModule,
  fs: emptyModule,
  assert: emptyModule,
  net: emptyModule,
  tls: emptyModule,
  child_process: emptyModule,
};

// Approach 2: resolveRequest — catches node:* prefixed imports and anything extraNodeModules misses
// This runs BEFORE the default Expo resolver
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // 1. Catch all node:* prefixed imports (node:crypto, node:stream, etc.)
  if (moduleName.startsWith('node:')) {
    return { type: 'empty' };
  }

  // 2. Catch bare Node.js built-in names
  const nodeBuiltins = [
    'crypto', 'stream', 'http', 'https', 'zlib', 'url',
    'util', 'buffer', 'process', 'os', 'path', 'fs',
    'assert', 'net', 'tls', 'child_process', 'dns',
    'querystring', 'punycode', 'readline', 'repl',
    'vm', 'v8', 'cluster', 'dgram', 'module',
    'perf_hooks', 'worker_threads', 'async_hooks',
  ];
  if (nodeBuiltins.includes(moduleName)) {
    return { type: 'empty' };
  }

  // 3. Fall back to original Expo resolver for everything else
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;