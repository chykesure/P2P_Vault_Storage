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

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // 1. Block all node:* imports — use type:empty (NOT sourceFile to avoid SHA-1 error)
  if (moduleName.startsWith('node:')) {
    return { type: 'empty' };
  }

  // 2. Block bare Node.js built-in names
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

  // 3. Redirect zod/mini (from porto) to root zod
  if (moduleName === 'zod/mini') {
    return context.resolveRequest(context, 'zod', platform);
  }

  // 4. BLANKET CATCH-ALL — catches ALL broken .cjs/.mjs entry points
  try {
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  } catch (e) {
    console.log(
      `[Metro] Module "${moduleName}" failed to resolve, returning empty. ` +
      `Reason: ${e.message.split('\n')[0]}`
    );
    return { type: 'empty' };
  }
};

module.exports = config;