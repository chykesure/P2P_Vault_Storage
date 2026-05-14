import { useState, useCallback, useEffect, useRef } from 'react';
import * as FileSystem from 'expo-file-system';
import { VaultFile, AddFileParams } from '../types';
import { fileIndexService } from '../services/fileIndexService';
import { useEncryption } from '../contexts/EncryptionContext';
import { useWeb3 } from '../contexts/Web3Context';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseFileVaultReturn {
  /** All files in the vault */
  files: VaultFile[];
  /** Whether files are being loaded */
  loading: boolean;
  /** Any error that occurred */
  error: string | null;
  /** Refresh the file list */
  refreshFiles: () => Promise<void>;
  /** Upload a new file to the vault */
  uploadFile: (
    fileUri: string,
    fileName: string,
    fileType: string,
    fileSize: number
  ) => Promise<VaultFile | null>;
  /** Download & decrypt a file by CID */
  downloadFile: (cid: string) => Promise<Uint8Array | string | null>;
  /** Find a file by its CID */
  getFileByCid: (cid: string) => Promise<VaultFile | null>;
  /** Delete a file from the index */
  deleteFile: (cid: string) => Promise<boolean>;
}

// ─── Helper: Uint8Array to Base64 ─────────────────────────────────────────────

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ─── Helper: Base64 to Uint8Array ─────────────────────────────────────────────

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFileVault(): UseFileVaultReturn {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { encrypt, decrypt, isUnlocked } = useEncryption();
  const { uploadToIPFS, downloadFromIPFS, account } = useWeb3();
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Refresh files from index ──────────────────────────────────────────────

  const refreshFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const allFiles = await fileIndexService.getAllFiles();
      if (mountedRef.current) {
        setFiles(allFiles);
      }
    } catch (err: any) {
      console.error('[useFileVault] Failed to refresh files:', err);
      if (mountedRef.current) {
        setError(err.message || 'Failed to load files');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Auto-refresh on mount and when account changes
  useEffect(() => {
    refreshFiles();
  }, [refreshFiles, account]);

  // ── Upload a file ─────────────────────────────────────────────────────────

  const uploadFile = useCallback(
    async (
      fileUri: string,
      fileName: string,
      fileType: string,
      fileSize: number
    ): Promise<VaultFile | null> => {
      try {
        setLoading(true);
        setError(null);

        // 1. Read file content
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (!fileInfo.exists) {
          throw new Error('File does not exist at the given URI');
        }

        let fileContent: string;
        if (fileInfo.size && fileInfo.size < 50 * 1024 * 1024) {
          // For files < 50MB, read as base64
          fileContent = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } else {
          throw new Error('File too large. Maximum size is 50MB.');
        }

        // 2. Encrypt if vault is unlocked
        let encryptedData: string | undefined;
        let encryptedKey: string | undefined;
        let iv: string | undefined;

        if (isUnlocked) {
          try {
            const result = await encrypt(fileContent);
            encryptedData = result.encrypted;
            encryptedKey = result.key;
            iv = result.iv;
          } catch (err: any) {
            console.warn('[useFileVault] Encryption failed, uploading unencrypted:', err);
            encryptedData = undefined;
          }
        }

        // 3. Upload to IPFS
        const dataToUpload = encryptedData || fileContent;
        const cid = await uploadToIPFS(dataToUpload);

        if (!cid) {
          throw new Error('Failed to upload to IPFS. No CID returned.');
        }

        // 4. Save to file index
        const addParams: AddFileParams = {
          cid,
          fileName,
          fileType,
          fileSize,
          ownerAddress: account || 'unknown',
          encrypted: !!encryptedData,
          encryptedKey,
          iv,
        };

        const newFile = await fileIndexService.addFileToIndex(addParams);

        // 5. Update local state
        if (mountedRef.current) {
          setFiles((prev) => [newFile, ...prev]);
        }

        console.log('[useFileVault] File uploaded successfully:', cid);
        return newFile;
      } catch (err: any) {
        console.error('[useFileVault] Upload failed:', err);
        if (mountedRef.current) {
          setError(err.message || 'Upload failed');
        }
        return null;
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [uploadToIPFS, account, encrypt, isUnlocked]
  );

  // ── Download & decrypt a file by CID ──────────────────────────────────────

  const downloadFile = useCallback(
    async (cid: string): Promise<Uint8Array | string | null> => {
      try {
        setError(null);

        // 1. Get file metadata from index (for encryption info)
        const fileMeta = await fileIndexService.getFileByCid(cid);

        // 2. Download raw data from IPFS
        const rawData = await downloadFromIPFS(cid);

        if (!rawData) {
          throw new Error('Failed to download from IPFS');
        }

        // 3. Decrypt if file was encrypted and we have the key/iv
        if (fileMeta?.encrypted && fileMeta.encryptedKey && fileMeta.iv) {
          try {
            // If vault is unlocked, decrypt using stored key/iv
            if (isUnlocked && typeof decrypt === 'function') {
              const decrypted = await decrypt(rawData, fileMeta.encryptedKey, fileMeta.iv);
              // Convert base64 string back to Uint8Array
              return base64ToUint8Array(decrypted);
            } else {
              console.warn('[useFileVault] File is encrypted but vault is locked');
              // Return raw data (user needs to unlock first)
              return typeof rawData === 'string' ? base64ToUint8Array(rawData) : rawData;
            }
          } catch (err: any) {
            console.error('[useFileVault] Decryption failed:', err);
            throw new Error('Decryption failed. Wrong password or corrupted data.');
          }
        }

        // 4. Return raw data for unencrypted files
        if (typeof rawData === 'string') {
          return base64ToUint8Array(rawData);
        }
        return rawData;
      } catch (err: any) {
        console.error('[useFileVault] Download failed:', err);
        if (mountedRef.current) {
          setError(err.message || 'Download failed');
        }
        return null;
      }
    },
    [downloadFromIPFS, decrypt, isUnlocked]
  );

  // ── Get file by CID ───────────────────────────────────────────────────────

  const getFileByCid = useCallback(async (cid: string): Promise<VaultFile | null> => {
    try {
      const file = await fileIndexService.getFileByCid(cid);
      return file;
    } catch (err: any) {
      console.error('[useFileVault] getFileByCid failed:', err);
      return null;
    }
  }, []);

  // ── Delete file ───────────────────────────────────────────────────────────

  const deleteFile = useCallback(async (cid: string): Promise<boolean> => {
    try {
      await fileIndexService.removeFileFromIndex(cid);
      if (mountedRef.current) {
        setFiles((prev) => prev.filter((f) => f.cid !== cid));
      }
      return true;
    } catch (err: any) {
      console.error('[useFileVault] Delete failed:', err);
      if (mountedRef.current) {
        setError(err.message || 'Delete failed');
      }
      return false;
    }
  }, []);

  return {
    files,
    loading,
    error,
    refreshFiles,
    uploadFile,
    downloadFile,
    getFileByCid,
    deleteFile,
  };
}
