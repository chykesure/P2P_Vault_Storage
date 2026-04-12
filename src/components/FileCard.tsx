/**
 * FileCard Component
 * 
 * Displays a single file record in a card format.
 * Shows file name, size, type, date, and CID.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  GestureResponderEvent,
} from 'react-native';
import { Ionicons as Icon } from '@expo/vector-icons';

import { VaultFile } from '@/types';
import { formatFileSize, formatTimestamp, shortenCid, getFileExtension, isImageType } from '@utils/formatters';

interface FileCardProps {
  file: VaultFile;
  onPress?: (event: GestureResponderEvent) => void;
  onDelete?: (cid: string) => void;
}

function getFileIcon(fileType: string, fileName: string): { name: string; color: string } {
  const ext = getFileExtension(fileName, fileType);

  if (isImageType(fileType)) return { name: 'image-outline', color: '#6C5CE7' };
  if (ext === 'pdf') return { name: 'document-text-outline', color: '#E74C3C' };
  if (['doc', 'docx'].includes(ext)) return { name: 'document-outline', color: '#3498DB' };
  if (['xls', 'xlsx'].includes(ext)) return { name: 'grid-outline', color: '#27AE60' };
  if (['mp4', 'mov', 'avi'].includes(ext)) return { name: 'videocam-outline', color: '#E67E22' };
  if (['mp3', 'wav', 'aac'].includes(ext)) return { name: 'musical-notes-outline', color: '#9B59B6' };
  if (['zip', 'rar', '7z'].includes(ext)) return { name: 'archive-outline', color: '#7F8C8D' };

  return { name: 'document-outline', color: '#95A5A6' };
}

export function FileCard({ file, onPress, onDelete }: FileCardProps) {
  const icon = getFileIcon(file.fileType, file.fileName);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Icon name={icon.name} size={32} color={icon.color} />
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.fileName} numberOfLines={1}>
          {file.fileName}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.fileSize}>{formatFileSize(file.fileSize)}</Text>
          <Text style={styles.metaSeparator}>•</Text>
          <Text style={styles.fileDate}>{formatTimestamp(file.timestamp)}</Text>
        </View>
        <Text style={styles.cidText} numberOfLines={1}>
          CID: {shortenCid(file.cid)}
        </Text>
      </View>

      {onDelete && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={(e) => {
            e.stopPropagation();
            onDelete(file.cid);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="trash-outline" size={20} color="#E74C3C" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginVertical: 6,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#F0EEFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  fileName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  fileSize: {
    fontSize: 12,
    color: '#636E72',
    fontWeight: '500',
  },
  metaSeparator: {
    fontSize: 12,
    color: '#B2BEC3',
    marginHorizontal: 6,
  },
  fileDate: {
    fontSize: 12,
    color: '#636E72',
  },
  cidText: {
    fontSize: 11,
    color: '#B2BEC3',
    fontFamily: 'monospace',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
});
