/**
 * LoadingOverlay Component
 * 
 * A full-screen loading overlay with progress indicator.
 * Used during file upload/download operations.
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { Ionicons as Icon } from '@expo/vector-icons';

import { UploadProgress } from '@/types';

interface LoadingOverlayProps {
  visible: boolean;
  progress: UploadProgress;
}

function getStageIcon(stage: UploadProgress['stage']): { name: string; color: string } {
  switch (stage) {
    case 'encrypting': return { name: 'lock-closed-outline', color: '#6C5CE7' };
    case 'uploading': return { name: 'cloud-upload-outline', color: '#3498DB' };
    case 'pinning': return { name: 'pin-outline', color: '#E67E22' };
    case 'recording': return { name: 'link-outline', color: '#9B59B6' };
    case 'done': return { name: 'checkmark-circle-outline', color: '#27AE60' };
    case 'error': return { name: 'alert-circle-outline', color: '#E74C3C' };
    default: return { name: 'hourglass-outline', color: '#636E72' };
  }
}

export function LoadingOverlay({ visible, progress }: LoadingOverlayProps) {
  const icon = getStageIcon(progress.stage);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Icon name={icon.name} size={48} color={icon.color} />

          {progress.stage !== 'done' && progress.stage !== 'error' ? (
            <ActivityIndicator size="large" color="#6C5CE7" style={styles.spinner} />
          ) : null}

          <Text style={styles.message}>{progress.message}</Text>

          {/* Progress Bar */}
          {(progress.stage !== 'done' && progress.stage !== 'error' && progress.stage !== 'idle') && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progress.progress}%`,
                      backgroundColor: progress.stage === 'error' ? '#E74C3C' : '#6C5CE7',
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{progress.progress}%</Text>
            </View>
          )}

          {/* Error Display */}
          {progress.stage === 'error' && progress.error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{progress.error}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    width: '85%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  spinner: {
    marginVertical: 16,
  },
  message: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    textAlign: 'center',
    marginBottom: 16,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#DFE6E9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#636E72',
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#FDEDEC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#E74C3C',
    textAlign: 'center',
  },
});
