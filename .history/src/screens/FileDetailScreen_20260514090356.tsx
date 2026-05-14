import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Animated,
  Alert,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { useFileVault } from '../hooks/useFileVault';
import { VaultFile } from '../types';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(timestamp: string | number | Date): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function FileDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { downloadFile, getFileByCid } = useFileVault();

  // ── State ──────────────────────────────────────────────────────────────────

  const [file, setFile] = useState<VaultFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [cidCopied, setCidCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Animation values ──────────────────────────────────────────────────────

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // ── Resolve file from route params (3-method fallback) ────────────────────

  const resolveFile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Method 1: Direct param — file passed as JSON string
      const paramFile = params.file as string | undefined;
      if (paramFile) {
        try {
          const parsed = JSON.parse(decodeURIComponent(paramFile));
          if (parsed && parsed.cid) {
            setFile(parsed);
            setLoading(false);
            return;
          }
        } catch {
          // Not JSON, continue to next method
        }
      }

      // Method 2: Nested params wrapper (expo-router nesting)
      const nestedParams = params.params as Record<string, any> | undefined;
      const nestedFile = nestedParams?.file as string | undefined;
      if (nestedFile) {
        try {
          const parsed = JSON.parse(decodeURIComponent(nestedFile));
          if (parsed && parsed.cid) {
            setFile(parsed);
            setLoading(false);
            return;
          }
        } catch {
          // Not JSON, continue to next method
        }
      }

      // Method 3: Search by CID in the file index
      const cid = (params.cid as string) || (params.fileCid as string) || '';
      if (cid && typeof getFileByCid === 'function') {
        try {
          const found = await getFileByCid(cid);
          if (found) {
            setFile(found);
            setLoading(false);
            return;
          }
        } catch {
          // Search failed, continue to not-found
        }
      }

      // All methods failed — file is null, show not-found state
      setFile(null);
      setError(
        'File not found. It may have been removed or the link is invalid.'
      );
    } catch (err: any) {
      console.error('Error resolving file:', err);
      setError(err.message || 'Failed to load file details.');
    } finally {
      setLoading(false);
    }
  }, [params, getFileByCid]);

  useEffect(() => {
    resolveFile();
  }, [resolveFile]);

  // ── Entry animation ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!loading && file) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading, file]);

  // ── Download progress animation ───────────────────────────────────────────

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: downloadProgress / 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [downloadProgress]);

  // ── Copy CID to clipboard ─────────────────────────────────────────────────

  const copyCid = useCallback(async () => {
    if (!file?.cid) return;
    try {
      await Clipboard.setStringAsync(file.cid);
      setCidCopied(true);
      setTimeout(() => setCidCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy CID:', err);
    }
  }, [file?.cid]);

  // ── Download & save to device ─────────────────────────────────────────────

  const handleDownload = useCallback(async () => {
    if (!file) return;

    try {
      setDownloading(true);
      setDownloadProgress(0);

      // Download file data (decrypted bytes)
      const fileData = await downloadFile(file.cid);

      if (!fileData) {
        Alert.alert(
          'Download Failed',
          'Could not retrieve file data from the network.'
        );
        return;
      }

      setDownloadProgress(50);

      // Build a safe filename
      const safeName = (file.fileName || `file_${file.cid.slice(0, 8)}`).replace(
        /[^a-zA-Z0-9._-]/g,
        '_'
      );

      // Determine file URI for local storage
      const dir =
        Platform.OS === 'android'
          ? FileSystem.documentDirectory + 'Downloads/'
          : FileSystem.documentDirectory;

      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }

      const fileUri = dir + safeName;

      // Convert Uint8Array to Base64 for FileSystem.writeAsStringAsync
      let base64: string;
      if (fileData instanceof Uint8Array) {
        let binary = '';
        for (let i = 0; i < fileData.length; i++) {
          binary += String.fromCharCode(fileData[i]);
        }
        base64 = btoa(binary);
      } else if (typeof fileData === 'string') {
        base64 = btoa(fileData);
      } else {
        base64 = btoa(JSON.stringify(fileData));
      }

      setDownloadProgress(75);

      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setDownloadProgress(100);

      // Share / save via system share sheet
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: file.fileType || 'application/octet-stream',
          dialogTitle: `Save ${safeName}`,
          UTI: file.fileType || undefined,
        });
      } else {
        Alert.alert('Download Complete', `File saved to:\n${fileUri}`, [
          {
            text: 'OK',
            onPress: () => {
              if (Platform.OS === 'android') {
                Linking.openURL(fileUri).catch(() => {});
              }
            },
          },
        ]);
      }
    } catch (err: any) {
      console.error('Download error:', err);
      Alert.alert('Download Error', err.message || 'An unexpected error occurred.');
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
  }, [file, downloadFile]);

  // ── Delete file ───────────────────────────────────────────────────────────

  const handleDelete = useCallback(() => {
    if (!file) return;
    Alert.alert(
      'Delete File',
      `Are you sure you want to delete "${file.fileName || 'this file'}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            router.back();
          },
        },
      ]
    );
  }, [file, router]);

  // ── Pressable animation helper ────────────────────────────────────────────

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  }, []);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, []);

  // ── File icon resolver ────────────────────────────────────────────────────

  const getFileIcon = (
    fileType?: string
  ): React.ComponentProps<typeof Ionicons>['name'] => {
    if (!fileType) return 'document-outline';
    const t = fileType.toLowerCase();
    if (t.includes('image')) return 'image-outline';
    if (t.includes('video')) return 'videocam-outline';
    if (t.includes('audio')) return 'musical-notes-outline';
    if (t.includes('pdf')) return 'document-text-outline';
    if (t.includes('zip') || t.includes('rar') || t.includes('tar'))
      return 'archive-outline';
    if (
      t.includes('json') ||
      t.includes('javascript') ||
      t.includes('typescript')
    )
      return 'code-slash-outline';
    return 'document-outline';
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════════════

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>Loading file details...</Text>
      </View>
    );
  }

  // ── Error / Not-found state ───────────────────────────────────────────────
  if (!file || error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF6B6B" />
          <Text style={styles.errorTitle}>File Not Found</Text>
          <Text style={styles.errorMessage}>
            {error ||
              'The file could not be found. It may have been removed or the link is invalid.'}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.errorButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main content ──────────────────────────────────────────────────────────
  const fileIcon = getFileIcon(file.fileType);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Custom Header ────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color="#2D3436" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          File Details
        </Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleDelete}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={22} color="#FF6B6B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.animatedContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* ── File Icon Card ──────────────────────────────────────────── */}
          <View style={styles.iconCard}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Ionicons name={fileIcon} size={72} color="#6C5CE7" />
            </Animated.View>
            <Text style={styles.fileName} numberOfLines={2}>
              {file.fileName || 'Untitled File'}
            </Text>
            <Text style={styles.fileType}>
              {(file.fileType || 'Unknown type').toUpperCase()}
            </Text>
          </View>

          {/* ── File Information ────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>File Information</Text>

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Ionicons name="save-outline" size={18} color="#6C5CE7" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Size</Text>
                <Text style={styles.infoValue}>
                  {file.fileSize ? formatFileSize(file.fileSize) : 'Unknown'}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Ionicons name="calendar-outline" size={18} color="#6C5CE7" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Uploaded</Text>
                <Text style={styles.infoValue}>
                  {file.uploadedAt ? formatDate(file.uploadedAt) : 'Unknown'}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Ionicons name="cloud-outline" size={18} color="#6C5CE7" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Storage</Text>
                <Text style={styles.infoValue}>IPFS (Decentralized)</Text>
              </View>
            </View>

            {file.encrypted && (
              <View style={styles.infoRow}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="lock-closed-outline" size={18} color="#00B894" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Encryption</Text>
                  <Text style={[styles.infoValue, { color: '#00B894' }]}>
                    AES-256 Encrypted
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* ── CID Section ─────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Content Identifier (CID)</Text>
            <Pressable
              style={({ pressed }) => [
                styles.cidBox,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={copyCid}
              onLongPress={copyCid}
            >
              <Text style={styles.cidText} numberOfLines={3}>
                {file.cid}
              </Text>
              <View style={styles.cidCopyBadge}>
                {cidCopied ? (
                  <View style={styles.copiedBadge}>
                    <Ionicons name="checkmark-circle" size={18} color="#00B894" />
                    <Text style={styles.copiedText}>Copied!</Text>
                  </View>
                ) : (
                  <View style={styles.copyBadge}>
                    <Ionicons name="copy-outline" size={16} color="#6C5CE7" />
                    <Text style={styles.copyText}>Copy</Text>
                  </View>
                )}
              </View>
            </Pressable>
            <Text style={styles.cidHint}>Tap to copy full CID to clipboard</Text>
          </View>

          {/* ── Actions ─────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>

            {/* Progress bar */}
            {downloading && (
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Downloading...</Text>
                  <Text style={styles.progressPercent}>
                    {Math.round(downloadProgress)}%
                  </Text>
                </View>
                <View style={styles.progressBarBg}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            {/* Download button */}
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.downloadButton,
                { opacity: pressed || downloading ? 0.7 : 1 },
              ]}
              onPress={handleDownload}
              disabled={downloading}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                {downloading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="download-outline" size={22} color="#FFFFFF" />
                )}
              </Animated.View>
              <Text style={styles.actionButtonText}>
                {downloading ? 'Downloading...' : 'Download to Device'}
              </Text>
            </Pressable>

            {/* Share button */}
            {!downloading && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.shareButton,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={async () => {
                  if (file.cid) {
                    const gatewayUrl = `https://ipfs.io/ipfs/${file.cid}`;
                    if (await Sharing.isAvailableAsync()) {
                      await Sharing.shareAsync(gatewayUrl, {
                        dialogTitle: `Share ${file.fileName || 'File'}`,
                      });
                    } else {
                      Alert.alert('Share Link', gatewayUrl, [
                        {
                          text: 'Copy',
                          onPress: () => {
                            Clipboard.setStringAsync(gatewayUrl);
                          },
                        },
                        { text: 'OK' },
                      ]);
                    }
                  }
                }}
              >
                <Ionicons name="share-outline" size={22} color="#6C5CE7" />
                <Text style={[styles.actionButtonText, { color: '#6C5CE7' }]}>
                  Share IPFS Link
                </Text>
              </Pressable>
            )}
          </View>

          {/* Bottom spacing */}
          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#636E72',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F5',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#2D3436',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  animatedContainer: {
    paddingBottom: 20,
  },
  iconCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  fileName: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3436',
    textAlign: 'center',
  },
  fileType: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
    color: '#B2BEC3',
    letterSpacing: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B2BEC3',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F5',
  },
  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F0EDFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#B2BEC3',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2D3436',
    marginTop: 2,
  },
  cidBox: {
    backgroundColor: '#F8F7FF',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#6C5CE7',
    marginBottom: 8,
  },
  cidText: {
    fontSize: 13,
    color: '#636E72',
    fontFamily: 'Courier',
    lineHeight: 18,
  },
  cidCopyBadge: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  copyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#F0EDFF',
    borderRadius: 12,
  },
  copyText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  copiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#E8FFF5',
    borderRadius: 12,
  },
  copiedText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#00B894',
    fontWeight: '600',
  },
  cidHint: {
    fontSize: 11,
    color: '#B2BEC3',
    textAlign: 'center',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    color: '#636E72',
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#F0EDFF',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6C5CE7',
    borderRadius: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  downloadButton: {
    backgroundColor: '#6C5CE7',
  },
  shareButton: {
    backgroundColor: '#F0EDFF',
    borderWidth: 1,
    borderColor: '#D5CEFF',
  },
  actionButtonText: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#F8F9FA',
  },
  errorTitle: {
    marginTop: 20,
    fontSize: 22,
    fontWeight: '700',
    color: '#2D3436',
  },
  errorMessage: {
    marginTop: 10,
    fontSize: 14,
    color: '#636E72',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorButton: {
    marginTop: 30,
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: '#6C5CE7',
    borderRadius: 14,
  },
  errorButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
