/**
 * FileDetailScreen
 * 
 * Shows detailed information about a specific file in the vault.
 * Includes file metadata, CID, download option, and delete option.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
  ActivityIndicator,
  Clipboard,
} from 'react-native';
import { Ionicons as Icon } from '@expo/vector-icons';

import { useFileVault } from '@hooks/useFileVault';
import { VaultFile } from '@/types';
import { formatFileSize, formatTimestamp, getFileExtension, isImageType } from '@utils/formatters';
import { getIPFSUrl } from '@services/ipfsClient';
import { getCurrentChainConfig } from '@config/network';

export function FileDetailScreen({ route }: any) {
  const { cid } = route.params;
  const { files, downloadFile, deleteFile } = useFileVault();
  const [file, setFile] = useState<VaultFile | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const found = files.find(f => f.cid === cid);
    if (found) setFile(found);
  }, [cid, files]);

  if (!file) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>Loading file details...</Text>
      </View>
    );
  }

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const data = await downloadFile(file);
      if (data) {
        Alert.alert('Success', `Downloaded ${formatFileSize(data.byteLength)}`);
      } else {
        Alert.alert('Error', 'Failed to download file.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Download failed.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete File',
      'Remove this file record from the vault? The encrypted data on IPFS will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteFile(file.cid);
            if (success) {
              Alert.alert('Deleted', 'File record removed from vault.');
            }
          },
        },
      ],
    );
  };

  const handleCopyCid = () => {
    Clipboard.setString(file.cid);
    Alert.alert('Copied', 'CID copied to clipboard.');
  };

  const handleShare = async () => {
    const url = getIPFSUrl(file.cid);
    try {
      await Share.share({
        title: file.fileName,
        message: `Encrypted file: ${file.fileName}\nCID: ${file.cid}\nIPFS: ${url}`,
      });
    } catch {}
  };

  const ext = getFileExtension(file.fileName, file.fileType);
  const isImage = isImageType(file.fileType);
  const chainConfig = getCurrentChainConfig();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* File Icon */}
      <View style={styles.iconSection}>
        <View style={styles.fileIconLarge}>
          <Icon
            name={isImage ? 'image-outline' : 'document-outline'}
            size={56}
            color="#6C5CE7"
          />
        </View>
        <Text style={styles.fileName}>{file.fileName}</Text>
        <Text style={styles.fileType}>{file.fileType} • {ext.toUpperCase()}</Text>
      </View>

      {/* File Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statItemLabel}>Size</Text>
          <Text style={styles.statItemValue}>{formatFileSize(file.fileSize)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statItemLabel}>Uploaded</Text>
          <Text style={styles.statItemValue}>{formatTimestamp(file.timestamp)}</Text>
        </View>
      </View>

      {/* CID Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Content Identifier (CID)</Text>
        <View style={styles.cidBox}>
          <Text style={styles.cidText} selectable>
            {file.cid}
          </Text>
        </View>
        <View style={styles.cidActions}>
          <TouchableOpacity style={styles.cidAction} onPress={handleCopyCid}>
            <Icon name="copy-outline" size={16} color="#6C5CE7" />
            <Text style={styles.cidActionText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cidAction} onPress={handleShare}>
            <Icon name="share-outline" size={16} color="#6C5CE7" />
            <Text style={styles.cidActionText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cidAction}>
            <Icon name="open-outline" size={16} color="#6C5CE7" />
            <Text style={styles.cidActionText}>View on IPFS</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Blockchain Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Blockchain Record</Text>
        <View style={styles.infoRow}>
          <Icon name="link-outline" size={16} color="#636E72" />
          <Text style={styles.infoLabel}>Network:</Text>
          <Text style={styles.infoValue}>Sepolia Testnet</Text>
        </View>
        <View style={styles.infoRow}>
          <Icon name="document-text-outline" size={16} color="#636E72" />
          <Text style={styles.infoLabel}>Encryption:</Text>
          <Text style={styles.infoValue}>AES-256-CBC</Text>
        </View>
        <View style={styles.infoRow}>
          <Icon name="shield-checkmark-outline" size={16} color="#27AE60" />
          <Text style={styles.infoLabel}>Status:</Text>
          <Text style={[styles.infoValue, { color: '#27AE60' }]}>Encrypted & Secured</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        <TouchableOpacity
          style={[styles.actionButton, styles.downloadButton, isDownloading && styles.actionButtonDisabled]}
          onPress={handleDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name="download-outline" size={20} color="#fff" />
          )}
          <Text style={styles.actionButtonText}>
            {isDownloading ? 'Downloading...' : 'Download & Decrypt'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete}>
          <Icon name="trash-outline" size={20} color="#E74C3C" />
          <Text style={[styles.actionButtonText, { color: '#E74C3C' }]}>Delete Record</Text>
        </TouchableOpacity>
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          Files are encrypted before upload. Only your vault password can decrypt them.
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#636E72',
  },
  iconSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  fileIconLarge: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: '#F0EEFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3436',
    marginTop: 16,
  },
  fileType: {
    fontSize: 13,
    color: '#636E72',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
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
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemLabel: {
    fontSize: 12,
    color: '#636E72',
    marginBottom: 4,
  },
  statItemValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3436',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#ECF0F1',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 10,
  },
  cidBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ECF0F1',
  },
  cidText: {
    fontSize: 12,
    color: '#636E72',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  cidActions: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 10,
  },
  cidAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cidActionText: {
    fontSize: 13,
    color: '#6C5CE7',
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: '#636E72',
  },
  infoValue: {
    fontSize: 13,
    color: '#2D3436',
    fontWeight: '500',
  },
  actionsSection: {
    paddingHorizontal: 16,
    marginTop: 24,
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  downloadButton: {
    backgroundColor: '#6C5CE7',
  },
  deleteButton: {
    backgroundColor: '#FDEDEC',
    borderWidth: 1,
    borderColor: '#FADBD8',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  disclaimer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#B2BEC3',
    textAlign: 'center',
    lineHeight: 16,
  },
});
