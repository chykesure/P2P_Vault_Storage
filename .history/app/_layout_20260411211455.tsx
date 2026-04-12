import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, View, StyleSheet } from 'react-native';
import { Web3Wrapper } from '../src/contexts/Web3Context';
import { EncryptionProvider } from '../src/contexts/EncryptionContext';
import { AppNavigator } from '../src/navigation/AppNavigator';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <Web3Wrapper>
          <EncryptionProvider>
            <View style={styles.container}>
              <StatusBar barStyle="dark-content" backgroundColor="#0D1B2A" />
              <AppNavigator />
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