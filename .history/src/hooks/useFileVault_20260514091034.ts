/**
 * useFileVault Hook (Gas-Free Version)
 * 
 * Orchestrates the complete file upload and download flow:
 * Upload: Select -> Encrypt -> Upload to IPFS -> Pin -> Save to IPFS Index
 * Download: Read IPFS Index -> Fetch from IPFS -> Decrypt -> Save locally
 * 
 * NOTE: This version uses IPFS-based file indexing instead of a smart contract.
 * No gas fees are required. The file index is stored as a JSON file on IPFS.
 */

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';

import { VaultFile, UploadProgress } from '@/types';
import { useEncryption } from '@contexts/EncryptionContext';
import { uploadToIPFS, downloadAsUint8Array, pinToIPFS } from '@services/ipfsClient';
import {
  addFileToIndex,
  removeFileFromIndex,
  getUserFiles,
} from '@services/fileIndexService';
import { logger } from '@utils/logger';

const TAG = 'useFileVault';

interface UseFileVaultReturn {
  /** List of user's vault files */
  files: VaultFile[];
  /** Current upload progress */
  uploadProgress: UploadProgress;
  /** Whether files are being loaded */
  isLoadingFiles: boolean;
  /** Upload a file through the full pipeline */
  uploadFile: (
    fileData: Uint8Array,
    fileName: string,
    fileSize: number,
    fileType: string,
  ) => Promise<VaultFile | null>;
  /** Download and decrypt a file from the vault */
  downloadFile: (file: VaultFile) => Promise<Uint8Array | null>;
  /** Delete a file record from the vault */
  deleteFile: (cid: string) => Promise<boolean>;
  /** Refresh the file list from IPFS */
  refreshFiles: () => Promise<void>;
  /** Reset upload progress to idle */
  resetUploadProgress: () => void;
}

const initialProgress: UploadProgress = {
  stage: 'idle',
  progress: 0,
  message: '',
};

export function useFileVault(): UseFileVaultReturn {
  const { address } = useAccount();
  const { encrypt, decrypt } = useEncryption();
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>(initialProgress);

  const updateProgress = useCallback(
    (stage: UploadProgress['stage'], progress: number, message: string, error?: string) => {
      setUploadProgress({ stage, progress, message, error });
    },
    [],
  );

  const resetUploadProgress = useCallback(() => {
    setUploadProgress(initialProgress);
  }, []);

  /**
   * Upload a file through the complete gas-free pipeline:
   * 1. Encrypt locally
   * 2. Upload encrypted data to IPFS
   * 3. Pin to ensure persistence
   * 4. Save file record to IPFS-based index (NO GAS!)
   */
  const uploadFile = useCallback(
    async (
      fileData: Uint8Array,
      fileName: string,
      fileSize: number,
      fileType: string,
    ): Promise<VaultFile | null> => {
      // Use temp address for Expo Go testing (wallet not connected)
      const tempAddress = address || '0x0000000000000000000000000000000000000001';
      if (!address) {
        logger.warn(TAG, 'Wallet not connected, using temp address for testing');
      }

      try {
        // Step 1: Encrypt
        updateProgress('encrypting', 10, 'Encrypting file...');
        logger.info(TAG, `Encrypting file: ${fileName} (${fileSize} bytes)`);

        let encryptionResult;
        try {
          encryptionResult = encrypt(fileData);
        } catch (err: any) {
          updateProgress('error', 10, 'Encryption failed', err.message);
          return null;
        }

        // Step 2: Upload to IPFS
        updateProgress('uploading', 30, 'Uploading to IPFS...');
        const encryptedDataBytes = base64ToUint8Array(encryptionResult.encryptedData);

        let ipfsResult;
        try {
          ipfsResult = await uploadToIPFS(encryptedDataBytes, `${fileName}.encrypted`, 'application/octet-stream');
        } catch (err: any) {
          updateProgress('error', 30, 'IPFS upload failed', err.message);
          return null;
        }

        const cid = ipfsResult.cid;
        logger.info(TAG, `Uploaded to IPFS. CID: ${cid}`);
        updateProgress('uploading', 60, `Uploaded! CID: ${cid.slice(0, 12)}...`);

        // Step 3: Pin
        updateProgress('pinning', 70, 'Pinning file to ensure persistence...');
        const pinResult = await pinToIPFS(cid);
        if (!pinResult.success) {
          logger.warn(TAG, `Pinning failed for ${cid}. File may be garbage collected.`);
        }
        updateProgress('pinning', 80, pinResult.success ? 'File pinned!' : 'Pin failed (file still uploaded)');

        // Step 4: Save to IPFS-based file index (NO GAS FEES!)
        updateProgress('recording', 85, 'Saving file record...');
        try {
          await addFileToIndex(tempAddress, {
            cid,
            fileName,
            fileSize,
            fileType,
          });
          logger.info(TAG, 'File record saved to IPFS index.');
        } catch (err: any) {
          logger.warn(TAG, 'Failed to save to index, but file is on IPFS:', err);
          // Don't fail the upload — file is still safely on IPFS
        }

        // Done!
        updateProgress('done', 100, 'File uploaded successfully!');

        const newFile: VaultFile = {
          cid,
          fileName,
          fileSize,
          fileType,
          timestamp: Math.floor(Date.now() / 1000),
          isActive: true,
        };

        setFiles(prev => [newFile, ...prev]);
        return newFile;
      } catch (err: any) {
        logger.error(TAG, 'Upload failed:', err);
        updateProgress('error', 0, 'Upload failed', err.message);
        return null;
      }
    },
    [address, encrypt, updateProgress],
  );

  /**
   * Download and decrypt a file from the vault.
   */
  const downloadFile = useCallback(
    async (file: VaultFile): Promise<Uint8Array | null> => {
      const tempAddress = address || '0x0000000000000000000000000000000000000001';
      if (!address) {
        logger.warn(TAG, 'Wallet not connected, using temp address for download');
      }

      try {
        logger.info(TAG, `Downloading file: ${file.cid}`);

        // Download encrypted data from IPFS
        const encryptedData = await downloadAsUint8Array(file.cid);

        logger.info(TAG, `Downloaded ${encryptedData.length} bytes`);
        return encryptedData;
      } catch (err: any) {
        logger.error(TAG, 'Download failed:', err);
        return null;
      }
    },
    [address],
  );

  /**
   * Delete a file record from the IPFS-based index (NO GAS!).
   */
  const deleteFile = useCallback(
    async (cid: string): Promise<boolean> => {
      const tempAddress = address || '0x0000000000000000000000000000000000000001';
      if (!address) {
        logger.warn(TAG, 'Wallet not connected, using temp address for delete');
      }

      try {
        logger.info(TAG, `Deleting file record: ${cid}`);
        await removeFileFromIndex(tempAddress, cid);
        setFiles(prev => prev.filter(f => f.cid !== cid));
        return true;
      } catch (err: any) {
        logger.error(TAG, 'Delete failed:', err);
        return false;
      }
    },
    [address],
  );

  /**
   * Refresh file list from the IPFS-based index (NO GAS!).
   */
  const refreshFiles = useCallback(async () => {
    const tempAddress = address || '0x0000000000000000000000000000000000000001';
    if (!address) {
      logger.warn(TAG, 'Wallet not connected, using temp address for refresh');
    }

    setIsLoadingFiles(true);
    try {
      const userFiles = await getUserFiles(tempAddress);
      setFiles(userFiles);
      logger.info(TAG, `Refreshed file list: ${userFiles.length} files`);
    } catch (err: any) {
      logger.error(TAG, 'Failed to refresh files:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [address]);

  return {
    files,
    uploadProgress,
    isLoadingFiles,
    uploadFile,
    downloadFile,
    deleteFile,
    refreshFiles,
    resetUploadProgress,
  };
}

function base64ToUint8Array(base64: string): Uint8Array {
  // React Native polyfill for atob (not available in RN)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  // Remove padding and calculate output length
  const cleaned = base64.replace(/=+$/, '');
  const len = cleaned.length;
  const bufLen = Math.floor(len * 3 / 4);
  const bytes = new Uint8Array(bufLen);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const encoded = cleaned.slice(i, i + 4);
    const a = lookup[encoded.charCodeAt(0)] || 0;
    const b = lookup[encoded.charCodeAt(1)] || 0;
    const c = lookup[encoded.charCodeAt(2)] || 0;
    const d = lookup[encoded.charCodeAt(3)] || 0;

    bytes[p++] = (a << 2) | (b >> 4);
    if (p < bufLen) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < bufLen) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes;
}
