/**
 * useFileVault Hook (Gas-Free Version)
 * 
 * Encryption metadata (iv) is embedded in the file data itself,
 * so we never depend on the file index to store it.
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
  files: VaultFile[];
  uploadProgress: UploadProgress;
  isLoadingFiles: boolean;
  uploadFile: (
    fileData: Uint8Array,
    fileName: string,
    fileSize: number,
    fileType: string,
  ) => Promise<VaultFile | null>;
  downloadFile: (file: VaultFile) => Promise<Uint8Array | null>;
  getFileByCid: (cid: string) => Promise<VaultFile | null>;
  deleteFile: (cid: string) => Promise<boolean>;
  refreshFiles: () => Promise<void>;
  resetUploadProgress: () => void;
}

const initialProgress: UploadProgress = {
  stage: 'idle',
  progress: 0,
  message: '',
};

export function useFileVault(): UseFileVaultReturn {
  const { address } = useAccount();
  const { encrypt, decrypt, encryptionKey } = useEncryption();
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
   * Upload: file -> base64 -> encrypt -> "iv|hexData" -> upload to IPFS
   */
  const uploadFile = useCallback(
    async (
      fileData: Uint8Array,
      fileName: string,
      fileSize: number,
      fileType: string,
    ): Promise<VaultFile | null> => {
      const tempAddress = address || '0x0000000000000000000000000000000000000001';
      if (!address) {
        logger.warn(TAG, 'Wallet not connected, using temp address');
      }

      try {
        updateProgress('encrypting', 5, 'Preparing file...');

        // Step 1: Convert raw bytes to base64 string
        const fileBase64 = uint8ArrayToBase64(fileData);
        logger.info(TAG, `File to base64: ${fileBase64.length} chars`);

        // Step 2: Encrypt the base64 string
        updateProgress('encrypting', 15, 'Encrypting file...');

        let encryptionResult;
        try {
          encryptionResult = await encrypt(fileBase64);
        } catch (err: any) {
          updateProgress('error', 15, 'Encryption failed', err.message);
          return null;
        }

        // Step 3: Pack iv + encrypted data together with separator
        // Format: "iv|encryptedHex" — hex only uses 0-9a-f so | is safe as separator
        const payload = encryptionResult.iv + '|' + encryptionResult.encrypted;
        const payloadBytes = new TextEncoder().encode(payload);
        logger.info(TAG, `Payload: iv(${encryptionResult.iv.length}) + data(${encryptionResult.encrypted.length}) = ${payloadBytes.length} bytes`);

        // Step 4: Upload to IPFS
        updateProgress('uploading', 30, 'Uploading to IPFS...');
        let ipfsResult;
        try {
          ipfsResult = await uploadToIPFS(payloadBytes, `${fileName}.enc`, 'application/octet-stream');
        } catch (err: any) {
          updateProgress('error', 30, 'IPFS upload failed', err.message);
          return null;
        }

        const cid = ipfsResult.cid;
        logger.info(TAG, `Uploaded to IPFS. CID: ${cid}`);
        updateProgress('uploading', 60, `Uploaded! CID: ${cid.slice(0, 12)}...`);

        // Step 5: Pin
        updateProgress('pinning', 70, 'Pinning file...');
        const pinResult = await pinToIPFS(cid);
        if (!pinResult.success) {
          logger.warn(TAG, `Pinning failed for ${cid}`);
        }
        updateProgress('pinning', 80, pinResult.success ? 'File pinned!' : 'Pin failed (file still uploaded)');

        // Step 6: Save to index (without encryption metadata — it's in the file)
        updateProgress('recording', 85, 'Saving file record...');
        try {
          await addFileToIndex(tempAddress, {
            cid,
            fileName,
            fileSize,
            fileType,
            encrypted: true,
          });
          logger.info(TAG, 'File record saved to index.');
        } catch (err: any) {
          logger.warn(TAG, 'Index save failed, file still on IPFS:', err);
        }

        updateProgress('done', 100, 'File uploaded successfully!');

        const newFile: VaultFile = {
          cid,
          fileName,
          fileSize,
          fileType,
          encrypted: true,
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
   * Download: IPFS -> "iv|hexData" -> split -> decrypt -> original file
   */
  const downloadFile = useCallback(
    async (file: VaultFile): Promise<Uint8Array | null> => {
      try {
        logger.info(TAG, `Downloading file: ${file.cid}`);

        const encryptedBytes = await downloadAsUint8Array(file.cid);
        logger.info(TAG, `Downloaded ${encryptedBytes.length} bytes from IPFS`);

        // If vault is unlocked and file is encrypted, decrypt it
        if (file.encrypted && encryptionKey) {
          try {
            // Convert bytes to text, then split out the iv
            const rawText = new TextDecoder().decode(encryptedBytes);
            const separatorIndex = rawText.indexOf('|');

            if (separatorIndex === -1) {
              logger.warn(TAG, 'No iv separator found — old format file, returning raw');
              return encryptedBytes;
            }

            const iv = rawText.substring(0, separatorIndex);
            const encryptedHex = rawText.substring(separatorIndex + 1);

            logger.info(TAG, `Decrypting: iv=${iv} hexLen=${encryptedHex.length}`);

            // Decrypt: hex -> xorDecrypt -> original base64 string
            const decryptedBase64 = await decrypt(encryptedHex, encryptionKey, iv);

            // Convert base64 string back to bytes
            const originalBytes = base64ToUint8Array(decryptedBase64);
            logger.info(TAG, `Decrypted! ${originalBytes.length} bytes`);

            return originalBytes;
          } catch (err: any) {
            logger.error(TAG, 'Decryption failed:', err);
            return encryptedBytes;
          }
        }

        // Not encrypted — return raw bytes
        return encryptedBytes;
      } catch (err: any) {
        logger.error(TAG, 'Download failed:', err);
        return null;
      }
    },
    [decrypt, encryptionKey],
  );

  const getFileByCid = useCallback(
    async (cid: string): Promise<VaultFile | null> => {
      try {
        const allFiles = await getUserFiles(
          address || '0x0000000000000000000000000000000000000001'
        );
        const found = allFiles.find(f => f.cid === cid);
        return found || null;
      } catch (err: any) {
        logger.error(TAG, 'getFileByCid failed:', err);
        return null;
      }
    },
    [address],
  );

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

  const refreshFiles = useCallback(async () => {
    const tempAddress = address || '0x0000000000000000000000000000000000000001';
    if (!address) {
      logger.warn(TAG, 'Wallet not connected, using temp address for refresh');
    }

    setIsLoadingFiles(true);
    try {
      const userFiles = await getUserFiles(tempAddress);
      setFiles(userFiles);
      logger.info(TAG, `Refreshed: ${userFiles.length} files`);
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
    getFileByCid,
    deleteFile,
    refreshFiles,
    resetUploadProgress,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const triplet =
      (a << 16) | (b !== undefined ? b << 8 : 0) | (c !== undefined ? c : 0);
    base64 += chars[(triplet >> 18) & 0x3f];
    base64 += chars[(triplet >> 12) & 0x3f];
    base64 += b !== undefined ? chars[(triplet >> 6) & 0x3f] : '=';
    base64 += c !== undefined ? chars[triplet & 0x3f] : '=';
  }
  return base64;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
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