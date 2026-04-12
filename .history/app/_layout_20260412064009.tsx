import React, { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, View, StyleSheet } from 'react-native';
import { Web3Wrapper } from '../src/contexts/Web3Context';
import { EncryptionProvider } from '../src/contexts/EncryptionContext';
import { SplashScreen } from '../src/components/SplashScreen';
import { AppNavigator } from '../src/navigation/AppNavigator';

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashDismiss = () => {
    setShowSplash(false);
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <Web3Wrapper>
          <EncryptionProvider>
            <View style={styles.container}>
              <StatusBar barStyle="light-content" backgroundColor="#0D1B2A" />
              
              <SplashScreen isVisible={showSplash} onDismiss={handleSplashDismiss} />
              
              {!showSplash && <AppNavigator />}
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