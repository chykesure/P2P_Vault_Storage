module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          unstable_transformImportMeta: true,   // ← This fixes the `import.meta.env` error from zustand
        },
      ],
    ],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
          alias: {
            '@': './src',
            '@config': './src/config',
            '@contexts': './src/contexts',
            '@services': './src/services',
            '@hooks': './src/hooks',
            '@screens': './src/screens',
            '@components': './src/components',
            '@navigation': './src/navigation',
            '@utils': './src/utils',
            '@contracts': './contracts',
          },
        },
      ],
      // Required for WalletConnect + wagmi in Expo (keep this)
      'react-native-reanimated/plugin',
    ],
  };
};