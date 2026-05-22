
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [
  'expo.ts', 'expo.tsx', 'expo.js', 'expo.jsx',
  'ts', 'tsx', 'js', 'jsx', 'json', 'wasm',
];

const emptyModule = path.resolve(__dirname, 'src/shims/empty.js');
const mipdShim = path.resolve(__dirname, 'src/shims/mipd.js');

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
  dns: emptyModule,
  querystring: emptyModule,
  punycode: emptyModule,
  readline: emptyModule,
  repl: emptyModule,
  vm: emptyModule,
  v8: emptyModule,
  cluster: emptyModule,
  dgram: emptyModule,
  module: emptyModule,
  perf_hooks: emptyModule,
  worker_threads: emptyModule,
  async_hooks: emptyModule,
  window: emptyModule,
  localStorage: emptyModule,
  mipd: mipdShim,
};

module.exports = config;
'@