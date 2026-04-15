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
  TouchableOpacity,
  Alert,
} from 'react-native';
import { PasswordSetupModal } from '@components/PasswordSetupModal';
import { useEncryption } from '@contexts/EncryptionContext';

export function UnlockVaultScreen() {
  const { authenticate, reset, isLoading, error, clearError } = useEncryption();

  const handleResetPassword = () => {
    Alert.alert(
      'Reset Password',
      'This will delete your vault and ALL encrypted files permanently. You will need to create a new password.\n\nThis cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await reset();
            } catch (err) {
              console.error('Reset failed:', err);
            }
          },
        },
      ],
    );
  };

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

      {/* Forgot Password button */}
      <TouchableOpacity
        style={styles.forgotButton}
        onPress={handleResetPassword}
        disabled={isLoading}
      >
        <Text style={styles.forgotText}>Forgot Password?</Text>
      </TouchableOpacity>
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
  forgotButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  forgotText: {
    fontSize: 13,
    color: '#E74C3C',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});