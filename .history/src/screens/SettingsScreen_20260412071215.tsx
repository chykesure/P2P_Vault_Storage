/**
 * SettingsScreen
 * 
 * App settings including:
 * - Wallet info & disconnect
 * - Security (lock vault, change password)
 * - IPFS gateway configuration
 * - About section
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons as Icon } from '@expo/vector-icons';

import { useWeb3 } from '@contexts/Web3Context';
import { useEncryption } from '@contexts/EncryptionContext';
import { APP_NAME, APP_VERSION, DEFAULT_SETTINGS } from '@config/constants';
import { shortenAddress } from '@utils/formatters';
import { resetGatewayCache } from '@utils/gatewayFallback';

export function SettingsScreen() {
  const { isConnected, address, disconnect } = useWeb3();
  const { isAuthenticated, lock, reset } = useEncryption();

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Wallet',
      'Are you sure you want to disconnect your wallet?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            disconnect();
          },
        },
      ],
    );
  };

  const handleLock = () => {
    lock();
  };

  const handleResetVault = () => {
    Alert.alert(
      'Reset Vault',
      'WARNING: This will delete your encryption key. All previously encrypted files will be PERMANENTLY unrecoverable. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await reset();
              Alert.alert('Vault Reset', 'Your vault has been reset. Please create a new password.');
            } catch (err) {
              Alert.alert('Error', 'Failed to reset vault.');
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Wallet Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wallet</Text>
        <View style={styles.card}>
          {isConnected && address ? (
            <>
              <View style={styles.cardRow}>
                <Icon name="wallet-outline" size={20} color="#6C5CE7" />
                <View style={styles.cardRowInfo}>
                  <Text style={styles.cardRowLabel}>Connected</Text>
                  <Text style={styles.cardRowValue}>{shortenAddress(address, 8)}</Text>
                </View>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Active</Text>
                </View>
              </View>
              <View style={styles.cardDivider} />
              <TouchableOpacity style={styles.cardButton} onPress={handleDisconnect}>
                <Icon name="log-out-outline" size={18} color="#E74C3C" />
                <Text style={[styles.cardButtonText, { color: '#E74C3C' }]}>Disconnect Wallet</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.cardEmptyText}>No wallet connected</Text>
          )}
        </View>
      </View>

      {/* Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Icon name="shield-checkmark-outline" size={20} color="#27AE60" />
            <View style={styles.cardRowInfo}>
              <Text style={styles.cardRowLabel}>Encryption</Text>
              <Text style={styles.cardRowValue}>
                {isAuthenticated ? 'Unlocked' : 'Locked'}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: isAuthenticated ? '#E8F8F5' : '#FDEDEC' },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isAuthenticated ? '#27AE60' : '#E74C3C' },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: isAuthenticated ? '#27AE60' : '#E74C3C' },
                ]}
              >
                {isAuthenticated ? 'Active' : 'Locked'}
              </Text>
            </View>
          </View>

          {isAuthenticated && (
            <>
              <View style={styles.cardDivider} />
              <TouchableOpacity style={styles.cardButton} onPress={handleLock}>
                <Icon name="lock-closed-outline" size={18} color="#F39C12" />
                <Text style={[styles.cardButtonText, { color: '#F39C12' }]}>Lock Vault</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.cardDivider} />
          <TouchableOpacity style={styles.cardButton} onPress={handleResetVault}>
            <Icon name="warning-outline" size={18} color="#E74C3C" />
            <Text style={[styles.cardButtonText, { color: '#E74C3C' }]}>Reset Vault</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Network Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Network</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Icon name="globe-outline" size={20} color="#3498DB" />
            <View style={styles.cardRowInfo}>
              <Text style={styles.cardRowLabel}>Blockchain</Text>
              <Text style={styles.cardRowValue}>{networkName || 'Polygon Amoy Testnet'}</Text>
            </View>
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.cardRow}>
            <Icon name="server-outline" size={20} color="#3498DB" />
            <View style={styles.cardRowInfo}>
              <Text style={styles.cardRowLabel}>Storage</Text>
              <Text style={styles.cardRowValue}>IPFS (P2P)</Text>
            </View>
          </View>
          <View style={styles.cardDivider} />
          <TouchableOpacity
            style={styles.cardButton}
            onPress={() => {
              resetGatewayCache();
              Alert.alert('Done', 'Gateway cache reset. Will try all gateways fresh.');
            }}
          >
            <Icon name="refresh-outline" size={18} color="#636E72" />
            <Text style={styles.cardButtonText}>Reset Gateway Cache</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Icon name="information-circle-outline" size={20} color="#6C5CE7" />
            <View style={styles.cardRowInfo}>
              <Text style={styles.cardRowLabel}>{APP_NAME}</Text>
              <Text style={styles.cardRowValue}>Version {APP_VERSION}</Text>
            </View>
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.cardRow}>
            <Icon name="code-outline" size={20} color="#636E72" />
            <View style={styles.cardRowInfo}>
              <Text style={styles.cardRowLabel}>Technology</Text>
              <Text style={styles.cardRowValue}>React Native + IPFS + Ethereum</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Architecture Info */}
      <View style={styles.architectureInfo}>
        <Text style={styles.archTitle}>How It Works</Text>
        <Text style={styles.archText}>
          Your files are encrypted on-device using AES-256-CBC before being uploaded to the IPFS peer-to-peer network. The file CID is recorded on the Ethereum blockchain as proof of ownership. No centralized server stores your data or your encryption keys.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D3436',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardRowInfo: {
    flex: 1,
  },
  cardRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3436',
  },
  cardRowValue: {
    fontSize: 12,
    color: '#636E72',
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F8F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#27AE60',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#27AE60',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#ECF0F1',
    marginVertical: 12,
  },
  cardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  cardButtonText: {
    fontSize: 14,
    color: '#636E72',
    fontWeight: '500',
  },
  cardEmptyText: {
    fontSize: 14,
    color: '#B2BEC3',
    textAlign: 'center',
    paddingVertical: 8,
  },
  architectureInfo: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: '#F0EEFF',
    borderRadius: 14,
    padding: 16,
  },
  archTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6C5CE7',
    marginBottom: 6,
  },
  archText: {
    fontSize: 13,
    color: '#636E72',
    lineHeight: 18,
  },
});
