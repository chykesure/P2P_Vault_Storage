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
import { StatusBar, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';

import { Web3Wrapper } from '@contexts/Web3Context';
import { EncryptionProvider } from '@contexts/EncryptionContext';
import { ErrorBoundary } from '@components/ErrorBoundary';
import { AppNavigator } from '@navigation/AppNavigator';

// Keep the native splash screen visible until we're ready
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Give providers a moment to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.warn('App preparation error:', e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <Web3Wrapper>
            <EncryptionProvider>
              <View style={styles.container} onLayout={onLayoutRootView}>
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