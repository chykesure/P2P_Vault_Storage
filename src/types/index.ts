/**
 * Core type definitions for the P2P Storage Vault application.
 * These types are used across all modules for type safety.
 */

// ========================================
// File Types
// ========================================

/** Represents a single file record stored in the vault */
export interface VaultFile {
  /** IPFS Content Identifier */
  cid: string;
  /** Original file name (may be encrypted for privacy) */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** MIME type (e.g., 'image/jpeg', 'application/pdf') */
  fileType: string;
  /** Unix timestamp of upload */
  timestamp: number;
  /** Whether this file is still active (not deleted) */
  isActive: boolean;
  /** Local cache path (if downloaded to device) */
  localPath?: string;
}

/** Represents an encrypted file package ready for IPFS upload */
export interface EncryptedFilePackage {
  /** AES-encrypted file data as base64 string */
  encryptedData: string;
  /** AES key encrypted with the user's password-derived key */
  encryptedKey: string;
  /** Initialization Vector used for AES encryption */
  iv: string;
  /** Original file name (plain text) */
  fileName: string;
  /** Original file size in bytes */
  fileSize: number;
  /** MIME type */
  fileType: string;
}

/** Represents the metadata stored alongside encrypted data on IPFS */
export interface IPFSFileMetadata {
  /** The version of the encryption scheme used */
  encryptionVersion: string;
  /** Initialization Vector */
  iv: string;
  /** AES key encrypted with user's derived key */
  encryptedKey: string;
  /** Original file name */
  fileName: string;
  /** Original MIME type */
  fileType: string;
  /** Original file size */
  fileSize: number;
  /** Timestamp of encryption */
  encryptedAt: number;
}

// ========================================
// IPFS Types
// ========================================

/** Configuration for an IPFS gateway */
export interface IPFSGatewayConfig {
  /** Gateway base URL */
  url: string;
  /** Whether this gateway is currently reachable */
  isHealthy: boolean;
  /** Average response time in ms */
  latency: number;
}

/** Result from an IPFS upload operation */
export interface IPFSUploadResult {
  /** Content Identifier */
  cid: string;
  /** Size of the uploaded data */
  size: number;
  /** Gateway URL used for the upload */
  gatewayUsed: string;
  /** Time taken for the upload in ms */
  uploadTime: number;
}

/** Result from a pinning service operation */
export interface PinResult {
  /** Whether pinning was successful */
  success: boolean;
  /** The CID that was pinned */
  cid: string;
  /** Pinning service used */
  service: string;
  /** Estimated pin TTL (time-to-live) if available */
  pinExpiresAt?: number;
}

// ========================================
// Contract Types
// ========================================

/** Parameters for uploading a file record to the smart contract */
export interface AddFileParams {
  cid: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

/** Transaction receipt for contract operations */
export interface ContractTxReceipt {
  /** Transaction hash */
  hash: string;
  /** Block number */
  blockNumber: number;
  /** Gas used */
  gasUsed: string;
  /** Whether the transaction was successful */
  status: boolean;
}

/** Contract statistics */
export interface ContractStats {
  totalUsers: number;
  totalFiles: number;
}

// ========================================
// Encryption Types
// ========================================

/** Encryption result containing all data needed to decrypt later */
export interface EncryptionResult {
  /** Base64-encoded encrypted file data */
  encryptedData: string;
  /** Base64-encoded encrypted AES key */
  encryptedKey: string;
  /** Base64-encoded initialization vector */
  iv: string;
}

/** Decryption result */
export interface DecryptionResult {
  /** Decrypted file data as Uint8Array */
  data: Uint8Array;
  /** Original file name */
  fileName: string;
}

// ========================================
// Wallet / Web3 Types
// ========================================

/** Wallet connection state */
export interface WalletState {
  /** Whether a wallet is connected */
  isConnected: boolean;
  /** Connected wallet address (EIP-55 checksummed) */
  address: string | null;
  /** Connected chain ID */
  chainId: number | null;
  /** Whether the connection is currently being established */
  isConnecting: boolean;
  /** Last connection error, if any */
  error: string | null;
}

// ========================================
// App State Types
// ========================================

/** Overall upload progress state */
export interface UploadProgress {
  /** Current stage of the upload pipeline */
  stage: 'idle' | 'selecting' | 'encrypting' | 'uploading' | 'pinning' | 'recording' | 'done' | 'error';
  /** Progress percentage (0-100) for the current stage */
  progress: number;
  /** Human-readable status message */
  message: string;
  /** Error details if stage is 'error' */
  error?: string;
}

/** App-level settings */
export interface AppSettings {
  /** Currently selected IPFS gateway index */
  preferredGatewayIndex: number;
  /** Whether to auto-pin files after upload */
  autoPin: boolean;
  /** Maximum file size in bytes allowed for upload */
  maxFileSize: number;
  /** Whether to cache downloaded files locally */
  enableLocalCache: boolean;
  /** Theme preference */
  theme: 'light' | 'dark' | 'system';
}
