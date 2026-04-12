/**
 * File Index Service (Gas-Free)
 *
 * Instead of using a smart contract (which costs gas), this service
 * stores the user's file index as a JSON file on IPFS itself.
 *
 * How it works:
 * - Each wallet address has a unique index file on IPFS
 * - When a file is uploaded, the index JSON is updated and re-uploaded
 * - The index CID is cached locally in AsyncStorage for fast access
 * - No gas fees, no blockchain transactions, 100% free
 *
 * This is still decentralized because the index lives on IPFS,
 * a distributed file system with no single point of failure.
 */

import { VaultFile, AddFileParams } from '@/types';
import { uploadToIPFS, downloadAsUint8Array } from '@services/ipfsClient';
import { PINATA_CONFIG } from '@config/ipfs';
import { logger } from '@utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TAG = 'FileIndex';

// Storage key for caching the latest index CID locally
const INDEX_CID_CACHE_KEY = 'p2pvault_index_cid_cache';

// Storage key for caching file list locally (offline access)
const FILE_LIST_CACHE_KEY = 'p2pvault_file_list_cache';

/** The structure of the JSON file stored on IPFS as the file index */
interface FileIndexData {
  /** Wallet address of the file owner */
  owner: string;
  /** List of file records */
  files: VaultFile[];
  /** Version of the index format */
  version: number;
  /** Last updated timestamp */
  lastUpdated: number;
}

/**
 * Get the index file name for a wallet address.
 * Uses lowercase address for consistency.
 */
function getIndexFileName(address: string): string {
  return `vault_index_${address.toLowerCase()}.json`;
}

/**
 * Save a file record to the IPFS-based file index.
 * This replaces the smart contract's addFile() function.
 *
 * @param address - User's wallet address
 * @param params - File record parameters (cid, fileName, fileSize, fileType)
 * @returns The updated VaultFile
 */
export async function addFileToIndex(
  address: string,
  params: AddFileParams,
): Promise<VaultFile> {
  logger.info(TAG, `Adding file to index for ${address}: ${params.cid}`);

  // Step 1: Load existing index (or create new one)
  const index = await loadIndex(address);

  // Step 2: Check for duplicate
  const exists = index.files.some(f => f.cid === params.cid);
  if (exists) {
    throw new Error('File with this CID already exists in your vault.');
  }

  // Step 3: Add new file record
  const newFile: VaultFile = {
    cid: params.cid,
    fileName: params.fileName,
    fileSize: params.fileSize,
    fileType: params.fileType,
    timestamp: Math.floor(Date.now() / 1000),
    isActive: true,
  };

  index.files.unshift(newFile); // Add to beginning (newest first)
  index.lastUpdated = Math.floor(Date.now() / 1000);

  // Step 4: Save index to IPFS
  const indexCid = await saveIndexToIPFS(index);

  // Step 5: Cache the index CID locally
  await cacheIndexCID(address, indexCid);

  // Step 6: Cache file list locally
  await cacheFileList(address, index.files);

  logger.info(TAG, `File added to index. Index CID: ${indexCid}`);
  return newFile;
}

/**
 * Remove a file record from the IPFS-based file index.
 * This replaces the smart contract's removeFile() function.
 *
 * @param address - User's wallet address
 * @param cid - The CID to remove
 * @returns True if successful
 */
export async function removeFileFromIndex(
  address: string,
  cid: string,
): Promise<boolean> {
  logger.info(TAG, `Removing file from index for ${address}: ${cid}`);

  // Step 1: Load existing index
  const index = await loadIndex(address);

  // Step 2: Find and mark as inactive
  const fileIndex = index.files.findIndex(f => f.cid === cid);
  if (fileIndex === -1) {
    throw new Error('File not found in your vault.');
  }

  index.files[fileIndex].isActive = false;
  index.lastUpdated = Math.floor(Date.now() / 1000);

  // Step 3: Save updated index to IPFS
  const indexCid = await saveIndexToIPFS(index);

  // Step 4: Update caches
  await cacheIndexCID(address, indexCid);
  await cacheFileList(address, index.files);

  logger.info(TAG, `File removed from index. Index CID: ${indexCid}`);
  return true;
}

/**
 * Get all active files for a user from the IPFS-based index.
 * This replaces the smart contract's getActiveFiles() function.
 *
 * @param address - User's wallet address
 * @returns Array of active VaultFile objects
 */
export async function getUserFiles(address: string): Promise<VaultFile[]> {
  logger.info(TAG, `Fetching files for ${address}`);

  try {
    // Step 1: Try loading from IPFS
    const index = await loadIndex(address);
    const activeFiles = index.files.filter(f => f.isActive);

    logger.info(TAG, `Found ${activeFiles.length} active files`);
    return activeFiles;
  } catch (error) {
    logger.warn(TAG, 'Failed to load index from IPFS, trying local cache...');

    // Step 2: Fallback to local cache
    const cachedFiles = await getCachedFileList(address);
    if (cachedFiles.length > 0) {
      logger.info(TAG, `Loaded ${cachedFiles.length} files from local cache`);
      return cachedFiles;
    }

    // Step 3: No files found anywhere — return empty (first-time user)
    logger.info(TAG, 'No existing index found. This is a new user.');
    return [];
  }
}

/**
 * Get the total count of active files for a user.
 */
export async function getActiveFileCount(address: string): Promise<number> {
  const files = await getUserFiles(address);
  return files.length;
}

/**
 * Get the total count of all files (including deleted) for a user.
 */
export async function getTotalFileCount(address: string): Promise<number> {
  try {
    const index = await loadIndex(address);
    return index.files.length;
  } catch {
    return 0;
  }
}

/**
 * Check if a specific CID exists for a user.
 */
export async function hasFileInIndex(address: string, cid: string): Promise<boolean> {
  try {
    const index = await loadIndex(address);
    return index.files.some(f => f.cid === cid && f.isActive);
  } catch {
    return false;
  }
}

// ========================================
// Internal Helper Functions
// ========================================

/**
 * Load the file index for a user.
 * Tries IPFS first (using cached CID), then creates a new empty index.
 */
async function loadIndex(address: string): Promise<FileIndexData> {
  // Step 1: Try to get the cached index CID
  const cachedCID = await getCachedIndexCID(address);

  if (cachedCID) {
    try {
      // Step 2: Download index from IPFS
      const data = await downloadAsUint8Array(cachedCID);
      const jsonString = new TextDecoder().decode(data);
      const index: FileIndexData = JSON.parse(jsonString);

      // Verify the index belongs to this address
      if (index.owner.toLowerCase() === address.toLowerCase()) {
        return index;
      }
    } catch (error) {
      logger.warn(TAG, `Failed to load index from IPFS (CID: ${cachedCID}):`, error);
    }
  }

  // Step 3: Try to find index via Pinata metadata search
  try {
    const pinataIndex = await findIndexViaPinata(address);
    if (pinataIndex) {
      return pinataIndex;
    }
  } catch (error) {
    logger.warn(TAG, 'Pinata index search failed:', error);
  }

  // Step 4: Return a new empty index (first-time user)
  return createEmptyIndex(address);
}

/**
 * Create a new empty file index for a user.
 */
function createEmptyIndex(address: string): FileIndexData {
  return {
    owner: address,
    files: [],
    version: 1,
    lastUpdated: Math.floor(Date.now() / 1000),
  };
}

/**
 * Save the file index to IPFS via Pinata.
 * Returns the new CID of the index file.
 */
async function saveIndexToIPFS(index: FileIndexData): Promise<string> {
  const jsonString = JSON.stringify(index, null, 2);
  const data = new TextEncoder().encode(jsonString);
  const fileName = getIndexFileName(index.owner);

  const result = await uploadToIPFS(data, fileName, 'application/json');

  logger.info(TAG, `Index saved to IPFS. CID: ${result.cid}`);
  return result.cid;
}

/**
 * Search for a user's index file via Pinata metadata.
 * This is a fallback when the local CID cache is not available.
 */
async function findIndexViaPinata(address: string): Promise<FileIndexData | null> {
  if (!PINATA_CONFIG.jwt) {
    return null;
  }

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
      // Get the most recent index
      const latestPin = result.rows[0];
      const cid = latestPin.ipfs_pin_hash;

      // Download and parse the index
      const data = await downloadAsUint8Array(cid);
      const jsonString = new TextDecoder().decode(data);
      const index: FileIndexData = JSON.parse(jsonString);

      // Cache it for next time
      await cacheIndexCID(address, cid);

      return index;
    }
  } catch (error) {
    logger.warn(TAG, 'Pinata search failed:', error);
  }

  return null;
}

// ========================================
// Local Cache Helpers (AsyncStorage)
// ========================================

/**
 * Cache the index CID for a user address.
 */
async function cacheIndexCID(address: string, cid: string): Promise<void> {
  try {
    const cacheKey = `${INDEX_CID_CACHE_KEY}_${address.toLowerCase()}`;
    await AsyncStorage.setItem(cacheKey, cid);
  } catch (error) {
    logger.warn(TAG, 'Failed to cache index CID:', error);
  }
}

/**
 * Get the cached index CID for a user address.
 */
async function getCachedIndexCID(address: string): Promise<string | null> {
  try {
    const cacheKey = `${INDEX_CID_CACHE_KEY}_${address.toLowerCase()}`;
    return await AsyncStorage.getItem(cacheKey);
  } catch {
    return null;
  }
}

/**
 * Cache the file list locally for offline access.
 */
async function cacheFileList(address: string, files: VaultFile[]): Promise<void> {
  try {
    const cacheKey = `${FILE_LIST_CACHE_KEY}_${address.toLowerCase()}`;
    const jsonString = JSON.stringify(files);
    await AsyncStorage.setItem(cacheKey, jsonString);
  } catch (error) {
    logger.warn(TAG, 'Failed to cache file list:', error);
  }
}

/**
 * Get the cached file list for offline access.
 */
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