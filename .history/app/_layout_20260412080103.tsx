// MUST be first import — enables WalletConnect polyfills for React Native
import '@walletconnect/react-native-compat';

/**
 * App.tsx — Expo Root Component
 *
 * This is the main entry point for the P2P Storage Vault.
 * Expo automatically registers this component — no need for AppRegistry.
 *
 * Provider hierarchy:
 *   ErrorBoundary → GestureHandlerRootView → SafeAreaProvider
 *     → Web3Wrapper (wagmi + WalletConnect + QueryClient)
 *       → EncryptionProvider
 *         → AppNavigator
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Web3Wrapper } from '@contexts/Web3Context';
import { EncryptionProvider } from '@contexts/EncryptionContext';
import { ErrorBoundary } from '@components/ErrorBoundary';
import { AppNavigator } from '@navigation/AppNavigator';

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <Web3Wrapper>
            <EncryptionProvider>
              <View style={styles.container}>
                <StatusBar
                  barStyle="dark-content"
                  backgroundColor="#F7F8FC"
                  translucent={false}
                />
                <AppNavigator />
              </View>
            </EncryptionProvider>
          </Web3Wrapper>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },
});