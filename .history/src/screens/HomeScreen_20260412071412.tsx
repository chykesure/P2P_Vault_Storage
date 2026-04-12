/**
 * HomeScreen
 * 
 * The main dashboard screen. Shows:
 * - Wallet connection status
 * - Vault stats (total files, storage used)
 * - Quick actions (upload, view files)
 * - Recent files list
 * 
 * NOTE: Uses IPFS-based file index (gas-free, no smart contract).
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons as Icon } from '@expo/vector-icons';

import { WalletConnectButton } from '@components/WalletConnectButton';
import { FileCard } from '@components/FileCard';
import { LoadingOverlay } from '@components/LoadingOverlay';
import { useWeb3 } from '@contexts/Web3Context';
import { useFileVault } from '@hooks/useFileVault';
import { getTotalFileCount } from '@services/fileIndexService';
import { formatFileSize } from '@utils/formatters';
import { useNavigation } from '@react-navigation/native';

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const { isConnected, address, openModal, isProjectIdConfigured, error } = useWeb3();
  const { files, uploadProgress, isLoadingFiles, refreshFiles } = useFileVault();
  const [networkFileCount, setNetworkFileCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isConnected) {
      loadStats();
      refreshFiles();
    }
  }, [isConnected]);

  useEffect(() => {
    if (error) {
      Alert.alert('WalletConnect Error', error);
    }
  }, [error]);

  const loadStats = async () => {
    try {
      if (address) {
        const count = await getTotalFileCount(address);
        setNetworkFileCount(count);
      }
    } catch (err) {
      console.warn('Failed to load file count:', err);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), refreshFiles()]);
    setRefreshing(false);
  }, [refreshFiles]);

  const totalStorageUsed = files.reduce((sum, f) => sum + f.fileSize, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>P2P Vault</Text>
          <Text style={styles.appSubtitle}>Decentralized Storage</Text>
        </View>
        <WalletConnectButton />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C5CE7" />
        }
        showsVerticalScrollIndicator={false}
      >
        {!isConnected ? (
          /* Not Connected State */
          <View style={styles.notConnectedContainer}>
            <Icon name="wallet-outline" size={64} color="#B2BEC3" />
            <Text style={styles.notConnectedTitle}>Connect Your Wallet</Text>
            <Text style={styles.notConnectedSubtitle}>
              Connect a Web3 wallet to access your decentralized vault. Your wallet address is your identity.
            </Text>
            <TouchableOpacity style={styles.connectButton} onPress={openModal}>
              <Icon name="wallet-outline" size={20} color="#fff" />
              <Text style={styles.connectButtonText}>Connect Wallet</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Stats Cards */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Icon name="document-outline" size={24} color="#6C5CE7" />
                <Text style={styles.statValue}>{files.length}</Text>
                <Text style={styles.statLabel}>My Files</Text>
              </View>
              <View style={styles.statCard}>
                <Icon name="server-outline" size={24} color="#3498DB" />
                <Text style={styles.statValue}>{formatFileSize(totalStorageUsed)}</Text>
                <Text style={styles.statLabel}>Storage Used</Text>
              </View>
              <View style={styles.statCard}>
                <Icon name="globe-outline" size={24} color="#27AE60" />
                <Text style={styles.statValue}>{networkFileCount}</Text>
                <Text style={styles.statLabel}>Total Files</Text>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => navigation.navigate('Upload')}
                >
                  <View style={[styles.actionIcon, { backgroundColor: '#F0EEFF' }]}>
                    <Icon name="cloud-upload-outline" size={24} color="#6C5CE7" />
                  </View>
                  <Text style={styles.actionLabel}>Upload File</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => navigation.navigate('Files')}
                >
                  <View style={[styles.actionIcon, { backgroundColor: '#E8F8F5' }]}>
                    <Icon name="folder-outline" size={24} color="#27AE60" />
                  </View>
                  <Text style={styles.actionLabel}>Browse Files</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => navigation.navigate('Settings')}
                >
                  <View style={[styles.actionIcon, { backgroundColor: '#FEF9E7' }]}>
                    <Icon name="settings-outline" size={24} color="#F39C12" />
                  </View>
                  <Text style={styles.actionLabel}>Settings</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Recent Files */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Files</Text>
                {files.length > 0 && (
                  <TouchableOpacity onPress={() => navigation.navigate('Files')}>
                    <Text style={styles.seeAllText}>See All</Text>
                  </TouchableOpacity>
                )}
              </View>

              {files.length === 0 ? (
                <View style={styles.emptyState}>
                  <Icon name="cloud-offline-outline" size={48} color="#DFE6E9" />
                  <Text style={styles.emptyText}>No files yet</Text>
                  <Text style={styles.emptySubtext}>
                    Upload your first file to start building your decentralized vault.
                  </Text>
                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={() => navigation.navigate('Upload')}
                  >
                    <Text style={styles.uploadButtonText}>Upload First File</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                files.slice(0, 5).map(file => (
                  <FileCard
                    key={file.cid}
                    file={file}
                    onPress={() =>
                      navigation.navigate('FileDetail', { cid: file.cid })
                    }
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      <LoadingOverlay
        visible={uploadProgress.stage !== 'idle' && uploadProgress.stage !== 'done'}
        progress={uploadProgress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EEFF',
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2D3436',
  },
  appSubtitle: {
    fontSize: 12,
    color: '#636E72',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  notConnectedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  notConnectedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2D3436',
    marginTop: 20,
  },
  notConnectedSubtitle: {
    fontSize: 14,
    color: '#636E72',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    marginBottom: 24,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#636E72',
    marginTop: 2,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3436',
    paddingHorizontal: 20,
  },
  seeAllText: {
    fontSize: 13,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
  },
  actionCard: {
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D3436',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#636E72',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#B2BEC3',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 20,
  },
  uploadButton: {
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});