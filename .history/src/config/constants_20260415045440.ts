/**
 * Application-wide constants.
 * Central place for all magic numbers, limits, and default values.
 */

// App Info
export const APP_NAME = 'P2P Storage Vault';
export const APP_VERSION = '1.0.0';

// Encryption
export const ENCRYPTION_VERSION = 'aes-256-cbc-v1';
export const AES_KEY_LENGTH = 32; // 256 bits
export const IV_LENGTH = 16; // 128 bits
export const PBKDF2_ITERATIONS = 10000;
export const SALT_LENGTH = 32;
export const MIN_PASSWORD_LENGTH = 8;

// File Upload Limits
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for images
export const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB chunks

// Network
export const DEFAULT_CHAIN_ID = 11155111; // Sepolia testnet
export const RPC_TIMEOUT = 30000; // 30 seconds
export const TX_CONFIRMATION_WAIT_BLOCKS = 1;

// IPFS
export const IPFS_UPLOAD_TIMEOUT = 120000; // 2 minutes
export const IPFS_DOWNLOAD_TIMEOUT = 60000; // 1 minute
export const PINNING_CHECK_INTERVAL = 5000; // 5 seconds

// UI
export const LIST_FETCH_BATCH_SIZE = 20;
export const DEBOUNCE_SEARCH_MS = 300;
export const TOAST_DURATION_MS = 3000;

// Storage Keys (AsyncStorage)
export const STORAGE_KEYS = {
  ENCRYPTION_SALT: 'vault_encryption_salt',
  ENCRYPTION_VERIFIER: 'vault_encryption_verifier',
  WALLET_ADDRESS: 'vault_wallet_address',
  APP_SETTINGS: 'vault_app_settings',
  CACHED_FILES: 'vault_cached_files',
  GATEWAY_PREFERENCES: 'vault_gateway_preferences',
} as const;

// Default App Settings
export const DEFAULT_SETTINGS = {
  preferredGatewayIndex: 0,
  autoPin: true,
  maxFileSize: MAX_FILE_SIZE,
  enableLocalCache: true,
  theme: 'system' as const,
};