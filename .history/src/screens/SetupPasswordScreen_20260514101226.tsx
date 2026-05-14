/**
 * SetupPasswordScreen
 * 
 * Shown on first launch. The user must create a master password
 * to encrypt their vault before accessing the app.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { PasswordSetupModal } from '@components/PasswordSetupModal';
import { useEncryption } from '@contexts/EncryptionContext';

export function SetupPasswordScreen() {
  const { setupEncryption } = useEncryption();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetup = async (password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const success = await setupEncryption(password);

      if (success) {
        // AppNavigator watches isSetup/isUnlocked — it will auto-navigate to Home
        // No need to manually navigate here
      } else {
        setError('Failed to create password. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Background decoration */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      <View style={styles.content}>
        <Text style={styles.logo}>🔒</Text>
        <Text style={styles.appName}>P2P Vault</Text>
        <Text style={styles.tagline}>Decentralized Encrypted Storage</Text>
      </View>

      <PasswordSetupModal
        visible={true}
        mode="setup"
        onSubmit={handleSetup}
        error={error}
        isLoading={isLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#F0EEFF',
    top: -100,
    right: -80,
    opacity: 0.6,
  },
  bgCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#D5D0F7',
    bottom: -60,
    left: -60,
    opacity: 0.4,
  },
  content: {
    alignItems: 'center',
    marginBottom: -40,
    zIndex: 1,
  },
  logo: {
    fontSize: 64,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2D3436',
    marginTop: 12,
  },
  tagline: {
    fontSize: 14,
    color: '#636E72',
    marginTop: 4,
  },
});
