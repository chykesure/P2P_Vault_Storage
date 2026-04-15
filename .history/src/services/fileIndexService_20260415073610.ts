/**
 * File Index Service (Gas-Free)
 *
 * Stores user's file index as JSON on IPFS via Pinata.
 * Uses local AsyncStorage cache for fast/offline access.
 */

import { VaultFile, AddFileParams } from '@/types';
import { uploadToIPFS } from '@services/ipfsClient';
import { fetchTextWithFallback } from '@utils/gatewayFallback';
import { PINATA_CONFIG } from '@config/ipfs';
import { logger } from '@utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TAG = 'FileIndex';

const INDEX_CID_CACHE_KEY = 'p2pvault_index_cid_cache';
const FILE_LIST_CACHE_KEY = 'p2pvault_file_list_cache';

interface FileIndexData {
  owner: string;
  files: VaultFile[];
  version: number;
  lastUpdated: number;
}

function getIndexFileName(address: string): string {
  return `vault_index_${address.toLowerCase()}.json`;
}

export async function addFileToIndex(
  address: string,
  params: AddFileParams,
): Promise<VaultFile> {
  logger.info(TAG, `Adding file to index for ${address}: ${params.cid}`);

  const index = await loadIndex(address);

  const exists = index.files.some(f => f.cid === params.cid);
  if (exists) {
    throw new Error('File with this CID already exists in your vault.');
  }

  const newFile: VaultFile = {
    cid: params.cid,
    fileName: params.fileName,
    fileSize: params.fileSize,
    fileType: params.fileType,
    timestamp: Math.floor(Date.now() / 1000),
    isActive: true,
  };

  index.files.unshift(newFile);
  index.lastUpdated = Math.floor(Date.now() / 1000);

  const indexCid = await saveIndexToIPFS(index);

  await cacheIndexCID(address, indexCid);
  await cacheFileList(address, index.files);

  logger.info(TAG, `File added to index. Index CID: ${indexCid}`);
  return newFile;
}

export async function removeFileFromIndex(
  address: string,
  cid: string,
): Promise<boolean> {
  logger.info(TAG, `Removing file from index for ${address}: ${cid}`);

  const index = await loadIndex(address);

  const fileIndex = index.files.findIndex(f => f.cid === cid);
  if (fileIndex === -1) {
    throw new Error('File not found in your vault.');
  }

  index.files[fileIndex].isActive = false;
  index.lastUpdated = Math.floor(Date.now() / 1000);

  const indexCid = await saveIndexToIPFS(index);

  await cacheIndexCID(address, indexCid);
  await cacheFileList(address, index.files);

  logger.info(TAG, `File removed from index. Index CID: ${indexCid}`);
  return true;
}

export async function getUserFiles(address: string): Promise<VaultFile[]> {
  logger.info(TAG, `Fetching files for ${address}`);

  // Try local cache FIRST (instant, no network)
  const cachedFiles = await getCachedFileList(address);
  if (cachedFiles.length > 0) {
    logger.info(TAG, `Loaded ${cachedFiles.length} files from local cache`);
    return cachedFiles;
  }

  // Then try IPFS
  try {
    const index = await loadIndex(address);
    const activeFiles = index.files.filter(f => f.isActive);
    logger.info(TAG, `Found ${activeFiles.length} active files`);
    return activeFiles;
  } catch (error) {
    logger.warn(TAG, 'Failed to load index from IPFS:', error);
    return [];
  }
}

export async function getActiveFileCount(address: string): Promise<number> {
  const files = await getUserFiles(address);
  return files.length;
}

export async function getTotalFileCount(address: string): Promise<number> {
  try {
    const index = await loadIndex(address);
    return index.files.length;
  } catch {
    return 0;
  }
}

export async function hasFileInIndex(address: string, cid: string): Promise<boolean> {
  try {
    const index = await loadIndex(address);
    return index.files.some(f => f.cid === cid && f.isActive);
  } catch {
    return false;
  }
}

// ========================================
// Internal Helpers
// ========================================

async function loadIndex(address: string): Promise<FileIndexData> {
  const cachedCID = await getCachedIndexCID(address);

  if (cachedCID) {
    try {
      const index = await downloadIndexJSON(cachedCID);
      if (index.owner.toLowerCase() === address.toLowerCase()) {
        return index;
      }
    } catch (error) {
      logger.warn(TAG, `Failed to load index from IPFS (CID: ${cachedCID}):`, error);
    }
  }

  // Try Pinata metadata search
  try {
    const pinataIndex = await findIndexViaPinata(address);
    if (pinataIndex) {
      return pinataIndex;
    }
  } catch (error) {
    logger.warn(TAG, 'Pinata index search failed:', error);
  }

  return createEmptyIndex(address);
}

function createEmptyIndex(address: string): FileIndexData {
  return {
    owner: address,
    files: [],
    version: 1,
    lastUpdated: Math.floor(Date.now() / 1000),
  };
}

/**
 * Upload index as a proper JSON object to Pinata.
 * pinataContent stores the index directly — downloads return parseable JSON.
 */
async function saveIndexToIPFS(index: FileIndexData): Promise<string> {
  const fileName = getIndexFileName(index.owner);

  // Try Pinata first — upload as JSON object (not base64)
  if (PINATA_CONFIG.jwt) {
    try {
      const url = `${PINATA_CONFIG.baseUrl}${PINATA_CONFIG.pinJSONEndpoint}`;
      const body = JSON.stringify({
        pinataContent: index,
        pinataMetadata: {
          name: fileName,
          keyvalues: {
            app: 'P2PStorageVault',
            type: 'vault_index',
            vaultOwner: index.owner.toLowerCase(),
          },
        },
        pinataOptions: { cidVersion: 1 },
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PINATA_CONFIG.jwt}`,
          'Content-Type': 'application/json',
        },
        body,
      });

      if (response.ok) {
        const result = await response.json();
        const cid = result.IpfsHash || result.cid;
        logger.info(TAG, `Index saved to IPFS. CID: ${cid}`);
        return cid;
      }

      const errorText = await response.text();
      logger.warn(TAG, `Pinata index upload failed (${response.status}): ${errorText}`);
    } catch (error) {
      logger.warn(TAG, 'Pinata index upload failed:', error);
    }
  }

  // Fallback: use regular upload
  const jsonString = JSON.stringify(index, null, 2);
  const data = new TextEncoder().encode(jsonString);
  const result = await uploadToIPFS(data, fileName, 'application/json');
  logger.info(TAG, `Index saved to IPFS via fallback. CID: ${result.cid}`);
  return result.cid;
}

/**
 * Download index JSON from IPFS using text() for React Native reliability.
 */
async function downloadIndexJSON(cid: string): Promise<FileIndexData> {
  const { text } = await fetchTextWithFallback(cid);
  return JSON.parse(text);
}

async function findIndexViaPinata(address: string): Promise<FileIndexData | null> {
  if (!PINATA_CONFIG.jwt) return null;

  try {
    const url = `${PINATA_CONFIG.baseUrl}/data/pinList?status=pinned&pageLimit=100&metadata[keyvalues][vaultOwner]={"value":"${address.toLowerCase()}","op":"eq"}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PINATA_CONFIG.jwt}`,
      },
    });

    if (!response.ok) return null;

    const result = await response.json();
    if (result.rows && result.rows.length > 0) {
      const latestPin = result.rows[0];
      const cid = latestPin.ipfs_pin_hash;

      const index = await downloadIndexJSON(cid);
      await cacheIndexCID(address, cid);
      return index;
    }
  } catch (error) {
    logger.warn(TAG, 'Pinata search failed:', error);
  }

  return null;
}

// ========================================
// Local Cache (AsyncStorage)
// ========================================

async function cacheIndexCID(address: string, cid: string): Promise<void> {
  try {
    const cacheKey = `${INDEX_CID_CACHE_KEY}_${address.toLowerCase()}`;
    await AsyncStorage.setItem(cacheKey, cid);
  } catch (error) {
    logger.warn(TAG, 'Failed to cache index CID:', error);
  }
}

async function getCachedIndexCID(address: string): Promise<string | null> {
  try {
    const cacheKey = `${INDEX_CID_CACHE_KEY}_${address.toLowerCase()}`;
    return await AsyncStorage.getItem(cacheKey);
  } catch {
    return null;
  }
}

async function cacheFileList(address: string, files: VaultFile[]): Promise<void> {
  try {
    const cacheKey = `${FILE_LIST_CACHE_KEY}_${address.toLowerCase()}`;
    await AsyncStorage.setItem(cacheKey, JSON.stringify(files));
  } catch (error) {
    logger.warn(TAG, 'Failed to cache file list:', error);
  }
}

async function getCachedFileList(address: string): Promise<VaultFile[]> {
  try {
    const cacheKey = `${FILE_LIST_CACHE_KEY}_${address.toLowerCase()}`;
    const jsonString = await AsyncStorage.getItem(cacheKey);
    if (!jsonString) return [];
    return JSON.parse(jsonString) as VaultFile[];
  } catch {
    return [];
  }
}