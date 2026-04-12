/**
 * WalletConnectButton Component
 * 
 * A button that shows wallet connection status.
 * Displays shortened address when connected,
 * or "Connect Wallet" when disconnected.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons as Icon } from '@expo/vector-icons';

import { useWeb3 } from '@contexts/Web3Context';
import { shortenAddress } from '@utils/formatters';

export function WalletConnectButton() {
  const { isConnected, address, isConnecting, openModal } = useWeb3();

  if (isConnecting) {
    return (
      <TouchableOpacity style={[styles.button, styles.connecting]} disabled>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={styles.text}>Connecting...</Text>
      </TouchableOpacity>
    );
  }

  if (isConnected && address) {
    return (
      <TouchableOpacity style={[styles.button, styles.connected]} onPress={openModal}>
        <Icon name="wallet-outline" size={18} color="#fff" />
        <Text style={styles.text}>{shortenAddress(address)}</Text>
        <View style={styles.statusDot} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={[styles.button, styles.disconnected]} onPress={openModal}>
      <Icon name="wallet-outline" size={18} color="#fff" />
      <Text style={styles.text}>Connect Wallet</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 8,
  },
  connected: {
    backgroundColor: '#27AE60',
  },
  disconnected: {
    backgroundColor: '#6C5CE7',
  },
  connecting: {
    backgroundColor: '#636E72',
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2ECC71',
  },
});
