/**
 * FileDetailScreen
 * 
 * Shows detailed information about a specific file in the vault.
 * Includes file metadata, CID, download & save option, and delete option.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Clipboard,
  Linking,
} from 'react-native';
import { Ionicons as Icon } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

import { useFileVault } from '@hooks/useFileVault';
import { VaultFile } from '@/types';
import { formatFileSize, formatTimestamp, getFileExtension, isImageType } from '@utils/formatters';
import { getIPFSUrl } from '@services/ipfsClient';
import { logger } from '@utils/logger';

export function FileDetailScreen({ route }: any) {
  const { downloadFile, deleteFile, refreshFiles, files } = useFileVault();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [file, setFile] = useState<VaultFile | null>(null);
  const [loading, setLoading] = useState(true);

  // Extract file from navigation params — handle nested navigator wrapping
  useEffect(() => {
    const params = route?.params || {};
    const directFile = params.file;
    const nestedFile = params.params?.file;
    const cid = params.cid || params.params?.cid;

    if (directFile) {
      logger.info('FileDetail', 'Got file from route.params.file');
      setFile(directFile);
      setLoading(false);
    } else if (nestedFile) {
      logger.info('FileDetail', 'Got file from route.params.params.file (nested)');
      setFile(nestedFile);
      setLoading(false);
    } else if (cid) {
      logger.info('FileDetail', `No file in params, searching by CID: ${cid}`);
    } else {
      logger.warn('FileDetail', 'No file or CID in route params', JSON.stringify(params));
    }
  }, [route?.params]);

  // If file wasn't in params, try finding by CID after files load
  useEffect(() => {
    if (file) return; // Already found
    if (files.length === 0) return;

    const params = route?.params || {};
    const cid = params.cid || params.params?.cid;
    if (!cid) return;

    const found = files.find((f: VaultFile) => f.cid === cid);
    if (found) {
      logger.info('FileDetail', `Found file by CID from vault: ${cid}`);
      setFile(found);
    }
    setLoading(false);
  }, [files]);

  // Trigger a file list refresh if we're still loading
  useEffect(() => {
    if (!file) {
      refreshFiles();
    }
  }, []);

  const handleDownload = async () => {
    if (!file) return;
    setIsDownloading(true);
    setDownloadStatus('Downloading from IPFS...');
    try {
      const data = await downloadFile(file);
      if (!data) {
        Alert.alert('Error', 'Failed to download file.');
        return;
      }

      setDownloadStatus('Saving to device...');

      // Convert Uint8Array to base64 for FileSystem
      const base64Data = uint8ArrayToBase64(data);

      // Build file path in device's document directory
      const ext = getFileExtension(file.fileName, file.fileType);
      const safeName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${FileSystem.documentDirectory}${safeName}`;

      // Write file to local storage
      await FileSystem.writeAsStringAsync(filePath, base64Data, { encoding: 'base64' });

      setDownloadStatus('Opening file...');

      // Check if sharing is available, then share/open the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: file.fileType || 'application/octet-stream',
          dialogTitle: `Save ${file.fileName}`,
        });
      } else {
        Alert.alert('Saved', `File saved to:\n${filePath}`);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Download failed.');
    } finally {
      setIsDownloading(false);
      setDownloadStatus('');
    }
  };

  const handleDelete = () => {
    if (!file) return;
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
    if (!file) return;
    Clipboard.setString(file.cid);
    Alert.alert('Copied', 'CID copied to clipboard.');
  };

  const handleOpenOnIpfs = () => {
    if (!file) return;
    const url = getIPFSUrl(file.cid);
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open URL in browser.');
    });
  };

  // ── Loading state ───────────────────────────────────────────────────────
  if (loading && !file) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>Loading file details...</Text>
      </View>
    );
  }

  // ── Not found state ─────────────────────────────────────────────────────
  if (!file) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="alert-circle-outline" size={48} color="#B2BEC3" />
        <Text style={styles.emptyTitle}>File Not Found</Text>
        <Text style={styles.emptySubtitle}>Could not load file details.</Text>
      </View>
    );
  }

  // ✅ FIX: These run ONLY after the null guard above — file is guaranteed non-null
  const ext = getFileExtension(file.fileName, file.fileType);
  const isImage = isImageType(file.fileType);
  const iconInfo = getFileIconInfo(file.fileType, file.fileName);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* File Icon + Name */}
      <View style={styles.iconSection}>
        <View style={[styles.fileIconLarge, { backgroundColor: iconInfo.bgColor }]}>
          <Icon name={iconInfo.name} size={50} color={iconInfo.color} />
        </View>
        <Text style={styles.fileName}>{file.fileName}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: iconInfo.bgColor }]}>
            <Text style={[styles.badgeText, { color: iconInfo.color }]}>
              {ext.toUpperCase()}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeTextMeta}>{formatFileSize(file.fileSize)}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeTextMeta}>{formatTimestamp(file.timestamp)}</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions Grid */}
      <View style={styles.quickActions}>
        <Pressable style={styles.quickAction} onPress={handleDownload} disabled={isDownloading}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#F0EEFF' }]}>
            {isDownloading ? (
              <ActivityIndicator size="small" color="#6C5CE7" />
            ) : (
              <Icon name="download-outline" size={22} color="#6C5CE7" />
            )}
          </View>
          <Text style={styles.quickActionLabel}>
            {isDownloading ? 'Saving...' : 'Save to Device'}
          </Text>
        </Pressable>

        <Pressable style={styles.quickAction} onPress={handleCopyCid}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#E8F8F5' }]}>
            <Icon name="copy-outline" size={22} color="#27AE60" />
          </View>
          <Text style={styles.quickActionLabel}>Copy CID</Text>
        </Pressable>

        <Pressable style={styles.quickAction} onPress={handleOpenOnIpfs}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#FEF9E7' }]}>
            <Icon name="globe-outline" size={22} color="#F39C12" />
          </View>
          <Text style={styles.quickActionLabel}>View on IPFS</Text>
        </Pressable>

        <Pressable style={styles.quickAction} onPress={handleDelete}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#FDEDEC' }]}>
            <Icon name="trash-outline" size={22} color="#E74C3C" />
          </View>
          <Text style={styles.quickActionLabel}>Delete</Text>
        </Pressable>
      </View>

      {/* Download status */}
      {downloadStatus ? (
        <View style={styles.statusBar}>
          <ActivityIndicator size="small" color="#6C5CE7" />
          <Text style={styles.statusText}>{downloadStatus}</Text>
        </View>
      ) : null}

      {/* CID Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Content Identifier</Text>
        <Pressable style={styles.cidBox} onPress={handleCopyCid}>
          <Text style={styles.cidText} selectable numberOfLines={3}>
            {file.cid}
          </Text>
          <Icon name="copy-outline" size={16} color="#B2BEC3" />
        </Pressable>
      </View>

      {/* File Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>File Information</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Icon name="document-outline" size={16} color="#636E72" />
            <Text style={styles.infoLabel}>Type</Text>
            <Text style={styles.infoValue}>{file.fileType}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Icon name="resize-outline" size={16} color="#636E72" />
            <Text style={styles.infoLabel}>Size</Text>
            <Text style={styles.infoValue}>{formatFileSize(file.fileSize)}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Icon name="calendar-outline" size={16} color="#636E72" />
            <Text style={styles.infoLabel}>Uploaded</Text>
            <Text style={styles.infoValue}>{formatTimestamp(file.timestamp)}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Icon name="shield-checkmark-outline" size={16} color="#27AE60" />
            <Text style={styles.infoLabel}>Encryption</Text>
            <Text style={[styles.infoValue, { color: '#27AE60' }]}>AES-256-CBC</Text>
          </View>
        </View>
      </View>

      {/* Big Download Button */}
      <View style={styles.actionsSection}>
        <Pressable
          style={({ pressed }) => [
            styles.downloadButton,
            isDownloading && styles.downloadButtonDisabled,
            pressed && !isDownloading && styles.downloadButtonPressed,
          ]}
          onPress={handleDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name="download-outline" size={20} color="#fff" />
          )}
          <Text style={styles.downloadButtonText}>
            {isDownloading ? 'Saving...' : 'Download & Save to Device'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          Files are encrypted before upload. Only your vault password can decrypt them.
        </Text>
      </View>
    </ScrollView>
  );
}

/**
 * Returns icon name, color, and background color based on file type.
 */
function getFileIconInfo(fileType: string, fileName: string): { name: any; color: string; bgColor: string } {
  const ext = getFileExtension(fileName, fileType);
  if (isImageType(fileType)) return { name: 'image-outline', color: '#6C5CE7', bgColor: '#F0EEFF' };
  if (ext === 'pdf') return { name: 'document-text-outline', color: '#E74C3C', bgColor: '#FDEDEC' };
  if (['doc', 'docx'].includes(ext)) return { name: 'document-outline', color: '#3498DB', bgColor: '#EBF5FB' };
  if (['xls', 'xlsx'].includes(ext)) return { name: 'grid-outline', color: '#27AE60', bgColor: '#E8F8F5' };
  if (['mp4', 'mov', 'avi'].includes(ext)) return { name: 'videocam-outline', color: '#E67E22', bgColor: '#FEF5E7' };
  if (['mp3', 'wav', 'aac'].includes(ext)) return { name: 'musical-notes-outline', color: '#9B59B6', bgColor: '#F4ECF7' };
  if (['zip', 'rar', '7z'].includes(ext)) return { name: 'archive-outline', color: '#7F8C8D', bgColor: '#F2F3F4' };
  return { name: 'document-outline', color: '#95A5A6', bgColor: '#F8F9FA' };
}

/**
 * Converts a Uint8Array to a base64 string.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#636E72',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#B2BEC3',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  iconSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  fileIconLarge: {
    width: 96,
    height: 96,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3436',
    marginTop: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  badge: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#636E72',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  quickAction: {
    alignItems: 'center',
    gap: 6,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#636E72',
    textAlign: 'center',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: '#F0EEFF',
    borderRadius: 10,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6C5CE7',
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
    paddingHorizontal: 4,
  },
  cidBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ECF0F1',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cidText: {
    fontSize: 12,
    color: '#636E72',
    fontFamily: 'monospace',
    lineHeight: 18,
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  infoLabel: {
    fontSize: 13,
    color: '#636E72',
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    color: '#2D3436',
    fontWeight: '600',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#ECF0F1',
    marginLeft: 40,
  },
  actionsSection: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C5CE7',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  downloadButtonPressed: {
    backgroundColor: '#5A4BD1',
  },
  downloadButtonDisabled: {
    backgroundColor: '#A29BFE',
    opacity: 0.8,
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: '700',
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
