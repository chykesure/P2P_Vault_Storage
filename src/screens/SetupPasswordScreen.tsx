/**
 * SetupPasswordScreen
 * 
 * Shown on first launch. The user must create a master password
 * to encrypt their vault before accessing the app.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { PasswordSetupModal } from '@components/PasswordSetupModal';
import { useEncryption } from '@contexts/EncryptionContext';

export function SetupPasswordScreen() {
  const { setup, isLoading, error, clearError } = useEncryption();

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
        onSubmit={setup}
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
