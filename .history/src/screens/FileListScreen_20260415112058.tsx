/**
 * FileListScreen
 * 
 * Displays all files in the user's vault with search and filter capabilities.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons as Icon } from '@expo/vector-icons';

import { FileCard } from '@components/FileCard';
import { useFileVault } from '@hooks/useFileVault';
import { VaultFile } from '@/types';
import { useNavigation } from '@react-navigation/native';

export function FileListScreen() {
  const navigation = useNavigation<any>();
  const { files, isLoadingFiles, refreshFiles, deleteFile } = useFileVault();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredFiles, setFilteredFiles] = useState<VaultFile[]>(files);

  useEffect(() => {
    refreshFiles();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredFiles(files);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredFiles(
        files.filter(
          f =>
            f.fileName.toLowerCase().includes(query) ||
            f.cid.toLowerCase().includes(query) ||
            f.fileType.toLowerCase().includes(query),
        ),
      );
    }
  }, [searchQuery, files]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFiles();
    setRefreshing(false);
  }, [refreshFiles]);

  const handleDelete = useCallback(
    (cid: string) => {
      Alert.alert(
        'Delete File',
        'Remove this file record from the vault? The encrypted data on IPFS will not be deleted.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const success = await deleteFile(cid);
              if (!success) {
                Alert.alert('Error', 'Failed to delete file record.');
              }
            },
          },
        ],
      );
    },
    [deleteFile],
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search-outline" size={18} color="#B2BEC3" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search files..."
          placeholderTextColor="#B2BEC3"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="close-circle" size={18} color="#B2BEC3" />
          </TouchableOpacity>
        )}
      </View>

      {/* Results Count */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultsText}>
          {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}
        </Text>
      </View>

      {/* File List */}
      <FlatList
        data={filteredFiles}
        keyExtractor={item => item.cid}
        renderItem={({ item }) => (
          <FileCard
            file={item}
            onPress={() => navigation.navigate('FileDetail', { file: item })}
            onDelete={handleDelete}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C5CE7" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {searchQuery ? (
              <>
                <Icon name="search-outline" size={48} color="#DFE6E9" />
                <Text style={styles.emptyTitle}>No Results</Text>
                <Text style={styles.emptySubtitle}>
                  No files matching "{searchQuery}"
                </Text>
              </>
            ) : (
              <>
                <Icon name="folder-open-outline" size={48} color="#DFE6E9" />
                <Text style={styles.emptyTitle}>No Files</Text>
                <Text style={styles.emptySubtitle}>
                  Your vault is empty. Upload files from the Upload tab.
                </Text>
              </>
            )}
          </View>
        }
        contentContainerStyle={filteredFiles.length === 0 ? styles.emptyListContent : undefined}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ECF0F1',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#2D3436',
    paddingVertical: 10,
  },
  resultsRow: {
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  resultsText: {
    fontSize: 13,
    color: '#636E72',
    fontWeight: '500',
  },
  emptyListContent: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
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
    marginBottom: 16,
  },
});