const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [
  'expo.ts', 'expo.tsx', 'expo.js', 'expo.jsx',
  'ts', 'tsx', 'js', 'jsx', 'json', 'wasm',
];

const emptyModule = path.resolve(__dirname, 'shims/emptyModule.js');

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

// Pre-compute the ROOT zod main entry path ONCE
let rootZodEntry = null;
try {
  rootZodEntry = require.resolve('zod', { paths: [__dirname] });
} catch (e) {
  console.log('[Metro] WARNING: Cannot find root zod package');
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

  // zod/mini points to a missing index.cjs — FORCE it to use root zod main entry
  if (moduleName === 'zod/mini') {
    if (rootZodEntry) {
      console.log('[Metro] Redirecting zod/mini -> ' + rootZodEntry);
      return { type: 'sourceFile', filePath: rootZodEntry };
    }
    return { type: 'empty' };
  }

  // All other zod imports — force ROOT resolution only
  if (moduleName === 'zod' || moduleName.startsWith('zod/')) {
    if (rootZodEntry) {
      try {
        const resolved = require.resolve(moduleName, { paths: [__dirname] });
        return { type: 'sourceFile', filePath: resolved };
      } catch (err) {
        // If subpath fails, fall back to root zod entry
        console.log('[Metro] zod subpath "' + moduleName + '" failed, using root zod');
        return { type: 'sourceFile', filePath: rootZodEntry };
      }
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