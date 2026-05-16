/**
 * useFileVault Hook — FINAL VERSION
 * 
 * Pure binary encryption. No hex strings. No separators.
 * Upload:  raw bytes → base64 bytes → XOR encrypt → [IV 12 bytes][encrypted] → IPFS
 * Download: IPFS → split at byte 12 → XOR decrypt → base64 decode → raw bytes
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
  const { encryptionKey } = useEncryption();
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
   * UPLOAD:
   * 1. file bytes → base64 string → UTF-8 bytes
   * 2. Generate 12 random IV bytes
   * 3. XOR encrypt those bytes (pure binary, no hex)
   * 4. Pack: [12 IV bytes] + [encrypted bytes] → upload to IPFS
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

      if (!encryptionKey) {
        updateProgress('error', 0, 'Vault is locked. Please unlock first.');
        return null;
      }

      try {
        // Step 1: Convert file bytes to base64 bytes
        updateProgress('encrypting', 5, 'Preparing file...');
        const fileBase64 = uint8ArrayToBase64(fileData);
        const base64Bytes = new TextEncoder().encode(fileBase64);
        logger.info(TAG, `File: ${fileSize} bytes → base64: ${base64Bytes.length} bytes`);

        // Step 2: Generate random 12-byte IV
        updateProgress('encrypting', 15, 'Encrypting file...');
        const ivBytes = new Uint8Array(12);
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          crypto.getRandomValues(ivBytes);
        } else {
          for (let i = 0; i < 12; i++) ivBytes[i] = Math.floor(Math.random() * 256);
        }

        // Step 3: XOR encrypt (pure binary — no hex, no strings)
        const keyBytes = new TextEncoder().encode(encryptionKey);
        const encryptedBytes = xorRaw(base64Bytes, keyBytes, ivBytes);
        logger.info(TAG, `Encrypted: ${encryptedBytes.length} bytes`);

        // Step 4: Pack IV + encrypted data into single binary blob
        // First 12 bytes = IV, rest = encrypted data
        const payload = new Uint8Array(12 + encryptedBytes.length);
        payload.set(ivBytes, 0);
        payload.set(encryptedBytes, 12);
        logger.info(TAG, `Payload: ${payload.length} bytes (12 IV + ${encryptedBytes.length} data)`);

        // Step 5: Upload to IPFS
        updateProgress('uploading', 30, 'Uploading to IPFS...');
        let ipfsResult;
        try {
          ipfsResult = await uploadToIPFS(payload, `${fileName}.enc`, 'application/octet-stream');
        } catch (err: any) {
          updateProgress('error', 30, 'IPFS upload failed', err.message);
          return null;
        }

        const cid = ipfsResult.cid;
        logger.info(TAG, `Uploaded! CID: ${cid}`);
        updateProgress('uploading', 60, `Uploaded! CID: ${cid.slice(0, 12)}...`);

        // Step 6: Pin
        updateProgress('pinning', 70, 'Pinning file...');
        const pinResult = await pinToIPFS(cid);
        if (!pinResult.success) {
          logger.warn(TAG, `Pinning failed for ${cid}`);
        }
        updateProgress('pinning', 80, pinResult.success ? 'File pinned!' : 'Pin failed (file still uploaded)');

        // Step 7: Save record to index
        updateProgress('recording', 85, 'Saving file record...');
        try {
          await addFileToIndex(tempAddress, {
            cid,
            fileName,
            fileSize,
            fileType,
            encrypted: true,
          });
          logger.info(TAG, 'File record saved.');
        } catch (err: any) {
          logger.warn(TAG, 'Index save failed:', err);
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
    [address, encryptionKey, updateProgress],
  );

  /**
   * DOWNLOAD:
   * 1. Fetch binary blob from IPFS
   * 2. Split: first 12 bytes = IV, rest = encrypted data
   * 3. XOR decrypt (pure binary)
   * 4. Decode base64 string → original file bytes
   */
  const downloadFile = useCallback(
    async (file: VaultFile): Promise<Uint8Array | null> => {
      try {
        logger.info(TAG, `Downloading: ${file.cid}`);
        const payload = await downloadAsUint8Array(file.cid);
        logger.info(TAG, `Downloaded ${payload.length} bytes from IPFS`);

        // Need vault key to decrypt
        if (!encryptionKey) {
          logger.warn(TAG, 'Vault locked — cannot decrypt, returning raw bytes');
          return payload;
        }

        // Need at least 12 bytes (IV)
        if (payload.length <= 12) {
          logger.warn(TAG, 'File too small to be encrypted, returning raw');
          return payload;
        }

        // Split: first 12 bytes = IV, rest = encrypted data
        const ivBytes = payload.slice(0, 12);
        const encryptedBytes = payload.slice(12);
        logger.info(TAG, `IV: 12 bytes, Encrypted: ${encryptedBytes.length} bytes`);

        // XOR decrypt (same operation as encrypt — XOR is its own inverse)
        const keyBytes = new TextEncoder().encode(encryptionKey);
        const decryptedBase64Bytes = xorRaw(encryptedBytes, keyBytes, ivBytes);

        // Decode base64 string → original file bytes
        const decryptedBase64 = new TextDecoder().decode(decryptedBase64Bytes);
        const originalBytes = base64ToUint8Array(decryptedBase64);
        logger.info(TAG, `Decrypted! ${originalBytes.length} bytes`);

        return originalBytes;
      } catch (err: any) {
        logger.error(TAG, 'Download failed:', err);
        return null;
      }
    },
    [encryptionKey],
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
        logger.warn(TAG, 'Wallet not connected, using temp address');
      }
      try {
        logger.info(TAG, `Deleting: ${cid}`);
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
      logger.warn(TAG, 'Wallet not connected, using temp address');
    }
    setIsLoadingFiles(true);
    try {
      const userFiles = await getUserFiles(tempAddress);
      setFiles(userFiles);
      logger.info(TAG, `Refreshed: ${userFiles.length} files`);
    } catch (err: any) {
      logger.error(TAG, 'Refresh failed:', err);
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

/** XOR encryption/decryption — same operation both ways */
function xorRaw(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length] ^ iv[i % iv.length];
  }
  return result;
}

/** Raw bytes → base64 string */
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

/** Base64 string → raw bytes */
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