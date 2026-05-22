const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [
  'expo.ts', 'expo.tsx', 'expo.js', 'expo.jsx',
  'ts', 'tsx', 'js', 'jsx', 'json', 'wasm',
];

const emptyModule = path.resolve(__dirname, 'src/shims/empty.js');

config.resolver.extraNodeModules = {
  crypto: emptyModule, stream: emptyModule, http: emptyModule,
  https: emptyModule, zlib: emptyModule, url: emptyModule,
  util: emptyModule, buffer: emptyModule, process: emptyModule,
  os: emptyModule, path: emptyModule, fs: emptyModule,
  assert: emptyModule, net: emptyModule, tls: emptyModule,
  child_process: emptyModule, dns: emptyModule, querystring: emptyModule,
  punycode: emptyModule, readline: emptyModule, repl: emptyModule,
  vm: emptyModule, v8: emptyModule, cluster: emptyModule,
  dgram: emptyModule, module: emptyModule, perf_hooks: emptyModule,
  worker_threads: emptyModule, async_hooks: emptyModule,
};

// Get ROOT zod main entry at startup - this is the ONLY zod file metro will ever read
var ROOT_ZOD_PATH = null;
try {
  ROOT_ZOD_PATH = require.resolve('zod', { paths: [__dirname] });
  console.log('[Metro] Root zod resolved to: ' + ROOT_ZOD_PATH);
} catch (e) {
  console.log('[Metro] ERROR: Cannot find root zod: ' + e.message);
}

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('node:')) {
    return { type: 'empty' };
  }

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

  // ALL zod imports go to ROOT zod/index.cjs only
  // Metro will NEVER touch zod/mini/index.cjs again
  if (moduleName === 'zod' || moduleName.startsWith('zod/')) {
    if (ROOT_ZOD_PATH) {
      return { type: 'sourceFile', filePath: ROOT_ZOD_PATH };
    }
  }

  // BLANKET CATCH-ALL for broken .cjs/.mjs packages
  try {
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  } catch (e) {
    console.log(
      '[Metro] Module "' + moduleName + '" failed to resolve, returning empty. ' +
      'Reason: ' + e.message.split('\n')[0]
    );
    return { type: 'empty' };
  }
};

module.exports = config;