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

import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, StyleSheet, View, Text, Image } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Web3Wrapper } from '@contexts/Web3Context';
import { EncryptionProvider } from '@contexts/EncryptionContext';
import { ErrorBoundary } from '@components/ErrorBoundary';
import { AppNavigator } from '@navigation/AppNavigator';

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Give providers a moment to initialize
        await new Promise(resolve => setTimeout(resolve, 800));
      } catch (e) {
        console.warn('App preparation error:', e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  if (!appIsReady) {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.splashContent}>
          <View style={styles.splashIconCircle}>
            <Text style={styles.splashEmoji}>🔒</Text>
          </View>
          <Text style={styles.splashTitle}>P2P Storage Vault</Text>
          <Text style={styles.splashSubtitle}>Decentralized Encrypted Storage</Text>
        </View>
      </View>
    );
  }

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
  splashContainer: {
    flex: 1,
    backgroundColor: '#6C5CE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContent: {
    alignItems: 'center',
  },
  splashIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  splashEmoji: {
    fontSize: 44,
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  splashSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '400',
  },
});