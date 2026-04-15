/**
 * UploadScreen
 * 
 * Handles file selection and initiates the upload pipeline.
 * Supports picking files from device storage or camera.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons as Icon } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

import { useFileVault } from '@hooks/useFileVault';
import { useEncryption } from '@contexts/EncryptionContext';
import { LoadingOverlay } from '@components/LoadingOverlay';
import { MAX_FILE_SIZE } from '@config/constants';
import { formatFileSize } from '@utils/formatters';

export function UploadScreen() {
  const { isAuthenticated } = useEncryption();
  const { uploadFile, uploadProgress, resetUploadProgress } = useFileVault();
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    type: string;
    uri: string;
  } | null>(null);

  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return; // User cancelled, not an error
      }

      // expo-document-picker v12+ returns file info in assets array
      const asset = result.assets?.[0];
      if (!asset) {
        Alert.alert('Error', 'No file was selected.');
        return;
      }

      if (asset.size && asset.size > MAX_FILE_SIZE) {
        Alert.alert(
          'File Too Large',
          `Maximum file size is ${formatFileSize(MAX_FILE_SIZE)}. Your file is ${formatFileSize(asset.size)}.`,
        );
        return;
      }

      console.log(`[Upload] Selected: ${asset.name} (${formatFileSize(asset.size || 0)}) type=${asset.mimeType} uri=${asset.uri}`);

      setSelectedFile({
        name: asset.name || 'Unknown',
        size: asset.size || 0,
        type: asset.mimeType || 'application/octet-stream',
        uri: asset.uri,
      });
    } catch (err: any) {
      console.error('[Upload] Document picker error:', err);
      Alert.alert('Error', 'Failed to pick file. Please try again.');
    }
  }, []);

  const handleUpload = async () => {
    if (!isAuthenticated) {
      Alert.alert('Vault Locked', 'Please unlock the vault with your password.');
      return;
    }
    if (!selectedFile) return;

    try {
      // Read file using FileSystem (reliable for all file types on iOS/Android)
      const fileInfo = await FileSystem.getInfoAsync(selectedFile.uri);
      if (!fileInfo.exists) {
        Alert.alert('Error', 'File not found. Please select it again.');
        return;
      }

      // Read as base64 — FileSystem handles file:// URIs properly
      const base64Content = await FileSystem.readAsStringAsync(selectedFile.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to Uint8Array
      const binaryString = atob(base64Content);
      const fileData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        fileData[i] = binaryString.charCodeAt(i);
      }

      await uploadFile(fileData, selectedFile.name, selectedFile.size, selectedFile.type);
      setSelectedFile(null);
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'An unexpected error occurred.');
    }
  };

  const isUploading = uploadProgress.stage !== 'idle' && uploadProgress.stage !== 'done';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* File Picker Area */}
        <TouchableOpacity style={styles.dropZone} onPress={pickDocument}>
          <Icon name="cloud-upload-outline" size={56} color="#6C5CE7" />
          <Text style={styles.dropZoneTitle}>Select a File</Text>
          <Text style={styles.dropZoneSubtitle}>
            Tap to browse your device for files to encrypt and store
          </Text>
          <Text style={styles.dropZoneHint}>
            Max size: {formatFileSize(MAX_FILE_SIZE)}
          </Text>
        </TouchableOpacity>

        {/* Selected File Preview */}
        {selectedFile && (
          <View style={styles.filePreview}>
            <View style={styles.filePreviewHeader}>
              <Icon name="document-outline" size={24} color="#6C5CE7" />
              <View style={styles.filePreviewInfo}>
                <Text style={styles.filePreviewName} numberOfLines={1}>
                  {selectedFile.name}
                </Text>
                <Text style={styles.filePreviewMeta}>
                  {formatFileSize(selectedFile.size)} • {selectedFile.type}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedFile(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close-circle" size={22} color="#B2BEC3" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Upload Pipeline Visualization */}
        {selectedFile && (
          <View style={styles.pipelineSection}>
            <Text style={styles.pipelineTitle}>Upload Pipeline</Text>
            <View style={styles.pipelineSteps}>
              <View style={styles.pipelineStep}>
                <View style={[styles.stepDot, { backgroundColor: '#6C5CE7' }]} />
                <Text style={styles.stepLabel}>Encrypt locally on device</Text>
              </View>
              <View style={styles.pipelineConnector} />
              <View style={styles.pipelineStep}>
                <View style={[styles.stepDot, { backgroundColor: '#3498DB' }]} />
                <Text style={styles.stepLabel}>Upload to IPFS (P2P)</Text>
              </View>
              <View style={styles.pipelineConnector} />
              <View style={styles.pipelineStep}>
                <View style={[styles.stepDot, { backgroundColor: '#E67E22' }]} />
                <Text style={styles.stepLabel}>Pin for persistence</Text>
              </View>
              <View style={styles.pipelineConnector} />
              <View style={styles.pipelineStep}>
                <View style={[styles.stepDot, { backgroundColor: '#9B59B6' }]} />
                <Text style={styles.stepLabel}>Record on blockchain</Text>
              </View>
            </View>
          </View>
        )}

        {/* Security Info */}
        <View style={styles.securityInfo}>
          <Icon name="shield-checkmark-outline" size={18} color="#27AE60" />
          <Text style={styles.securityText}>
            Files are encrypted on your device before upload. No one can read your files without your vault password.
          </Text>
        </View>

        {/* Upload Button */}
        <TouchableOpacity
          style={[
            styles.uploadButton,
            (!selectedFile || isUploading) && styles.uploadButtonDisabled,
          ]}
          onPress={handleUpload}
          disabled={!selectedFile || isUploading}
        >
          <Text style={styles.uploadButtonText}>
            {isUploading ? 'Uploading...' : 'Encrypt & Upload'}
          </Text>
        </TouchableOpacity>

        {/* Done State - Reset */}
        {uploadProgress.stage === 'done' && (
          <TouchableOpacity style={styles.doneButton} onPress={resetUploadProgress}>
            <Icon name="checkmark-circle-outline" size={20} color="#27AE60" />
            <Text style={styles.doneButtonText}>Upload Complete! Upload Another?</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <LoadingOverlay visible={isUploading} progress={uploadProgress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  dropZone: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#D5D0F7',
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 36,
    alignItems: 'center',
    marginBottom: 16,
  },
  dropZoneTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D3436',
    marginTop: 12,
  },
  dropZoneSubtitle: {
    fontSize: 13,
    color: '#636E72',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  dropZoneHint: {
    fontSize: 11,
    color: '#B2BEC3',
    marginTop: 8,
  },
  filePreview: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  filePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filePreviewInfo: {
    flex: 1,
    marginLeft: 12,
  },
  filePreviewName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3436',
  },
  filePreviewMeta: {
    fontSize: 12,
    color: '#636E72',
    marginTop: 2,
  },
  pipelineSection: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  pipelineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 14,
  },
  pipelineSteps: {
    alignItems: 'center',
  },
  pipelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepLabel: {
    fontSize: 13,
    color: '#636E72',
  },
  pipelineConnector: {
    width: 1,
    height: 16,
    backgroundColor: '#DFE6E9',
    marginLeft: 4.5,
  },
  securityInfo: {
    flexDirection: 'row',
    backgroundColor: '#E8F8F5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
    gap: 8,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: '#27AE60',
    lineHeight: 16,
  },
  uploadButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    backgroundColor: '#A29BFE',
    opacity: 0.6,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  doneButtonText: {
    fontSize: 14,
    color: '#27AE60',
    fontWeight: '600',
  },
});