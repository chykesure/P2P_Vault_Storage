import React, { useState, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, View, StyleSheet } from 'react-native';
import { Web3Wrapper } from '../src/contexts/Web3Context';
import { EncryptionProvider } from '../src/contexts/EncryptionContext';
import { SplashScreen } from '../src/components/SplashScreen';
import { AppNavigator } from '../src/navigation/AppNavigator';

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    // Show splash screen for at least 2.5 seconds
    const timer = setTimeout(() => {
      setShowSplash(false);
      setAppReady(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <Web3Wrapper>
          <EncryptionProvider>
            <View style={styles.container}>
              <StatusBar barStyle="light-content" backgroundColor="#0D1B2A" />
              
              {/* Splash Screen */}
              <SplashScreen isVisible={showSplash} />
              
              {/* Main App (hidden behind splash) */}
              {appReady && <AppNavigator />}
            </View>
          </EncryptionProvider>
        </Web3Wrapper>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, backgroundColor: '#0D1B2A' },
});