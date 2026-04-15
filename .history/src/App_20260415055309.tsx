/**
 * App.tsx — Expo Root Component
 *
 * This file is imported by app/_layout.tsx for provider setup.
 * The splash screen is handled in _layout.tsx — this file only
 * provides the app shell with all providers and navigation.
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Web3Wrapper } from '@contexts/Web3Context';
import { EncryptionProvider } from '@contexts/EncryptionContext';
import { ErrorBoundary } from '@components/ErrorBoundary';
import { AppNavigator } from '@navigation/AppNavigator';

/**
 * AppProviders — used by _layout.tsx to wrap the app with all providers.
 */
export function AppProviders() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <Web3Wrapper>
            <EncryptionProvider>
              <View style={{ flex: 1, backgroundColor: '#F7F8FC' }}>
                <AppNavigator />
              </View>
            </EncryptionProvider>
          </Web3Wrapper>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

/**
 * Default export — kept for compatibility.
 */
export default function App() {
  return <AppProviders />;
}