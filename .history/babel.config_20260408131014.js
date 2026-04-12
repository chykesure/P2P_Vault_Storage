module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
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
      // Required for WalletConnect + wagmi in Expo
      'react-native-reanimated/plugin',
    ],
  };
};
