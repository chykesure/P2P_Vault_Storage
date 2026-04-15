/**
 * UnlockVaultScreen
 * 
 * Shown when the user needs to enter their password
 * to unlock the vault (after app restart or manual lock).
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { PasswordSetupModal } from '@components/PasswordSetupModal';
import { useEncryption } from '@contexts/EncryptionContext';

export function UnlockVaultScreen() {
  const { authenticate, isLoading, error, clearError } = useEncryption();

  return (
    <View style={styles.container}>
      {/* Background decoration */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      <View style={styles.content}>
        <Text style={styles.logo}>🔐</Text>
        <Text style={styles.appName}>P2P Vault</Text>
        <Text style={styles.tagline}>Enter your password to unlock</Text>
      </View>

      <PasswordSetupModal
        visible={true}
        mode="unlock"
        onSubmit={authenticate}
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
    backgroundColor: '#FDEDEC',
    top: -100,
    right: -80,
    opacity: 0.5,
  },
  bgCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#FADBD8',
    bottom: -60,
    left: -60,
    opacity: 0.3,
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
