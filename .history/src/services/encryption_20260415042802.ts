/**
 * Encryption Service
 *
 * Handles all cryptographic operations for the P2P Storage Vault.
 * Uses AES-256-CBC for file encryption and PBKDF2 for key derivation
 * from the user's master password.
 *
 * Security Model:
 * 1. User sets a master password on first launch
 * 2. Password is used to derive a "Master Key" via PBKDF2
 * 3. For each file: generate a random AES-256 key, encrypt file, encrypt key with Master Key
 * 4. The encrypted key + IV + encrypted data are stored on IPFS
 * 5. To decrypt: derive Master Key from password, decrypt AES key, decrypt file
 */

import aesjs from 'aes-js';
import nacl from 'tweetnacl';
import * as AsyncStorage from '@react-native-async-storage/async-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
// ✅ default import — has getItem, setItem, removeItem
import * as Crypto from 'expo-crypto';

import { EncryptionResult, DecryptionResult } from '@/types';
import {
  AES_KEY_LENGTH,
  IV_LENGTH,
  PBKDF2_ITERATIONS,
  SALT_LENGTH,
  MIN_PASSWORD_LENGTH,
  ENCRYPTION_VERSION,
  STORAGE_KEYS,
} from '@config/constants';
import { logger } from '@utils/logger';

const TAG = 'Encryption';

/**
 * SHA-256 hash helper using expo-crypto.
 * Takes a hex string and returns a hex hash string.
 */
async function sha256(hexString: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, hexString);
}

// ========================================
// PBKDF2 Implementation (Pure JS)
// ========================================

/**
 * HMAC-SHA256 implementation for PBKDF2.
 * Uses expo-crypto for the underlying SHA-256 digest.
 */
async function hmacSha256(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const blockSize = 64;
  const keyPadded = new Uint8Array(blockSize);

  if (key.length > blockSize) {
    // Hash the key if longer than block size
    const keyHash = await sha256(bytesToHex(key));
    const keyHashBytes = hexToBytes(keyHash);
    keyPadded.set(keyHashBytes);
  } else {
    keyPadded.set(key);
  }

  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);

  for (let i = 0; i < blockSize; i++) {
    ipad[i] = keyPadded[i] ^ 0x36;
    opad[i] = keyPadded[i] ^ 0x5c;
  }

  // Inner hash
  const innerData = new Uint8Array(blockSize + message.length);
  innerData.set(ipad);
  innerData.set(message, blockSize);
  const innerHash = await sha256(bytesToHex(innerData));
  const innerBytes = hexToBytes(innerHash);

  // Outer hash
  const outerData = new Uint8Array(blockSize + 32);
  outerData.set(opad);
  outerData.set(innerBytes, blockSize);
  const outerHash = await sha256(bytesToHex(outerData));

  return hexToBytes(outerHash);
}

/**
 * PBKDF2-HMAC-SHA256 key derivation.
 * Derives a key of the specified length from password + salt.
 */
export async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
  keyLength: number,
): Promise<Uint8Array> {
  const passwordBytes = new TextEncoder().encode(password);
  const blockCount = Math.ceil(keyLength / 32); // SHA-256 produces 32-byte blocks
  const derivedKey = new Uint8Array(keyLength);

  for (let blockIndex = 1; blockIndex <= blockCount; blockIndex++) {
    // U1 = HMAC(password, salt || INT_32_BE(blockIndex))
    const blockIndexBytes = new Uint8Array(4);
    new DataView(blockIndexBytes.buffer).setUint32(0, blockIndex, false);

    const saltWithBlock = new Uint8Array(salt.length + 4);
    saltWithBlock.set(salt);
    saltWithBlock.set(blockIndexBytes, salt.length);

    let u = await hmacSha256(passwordBytes, saltWithBlock);
    const resultBlock = new Uint8Array(u);

    // U2 ... Uc
    for (let i = 1; i < iterations; i++) {
      u = await hmacSha256(passwordBytes, u);
      for (let j = 0; j < 32; j++) {
        resultBlock[j] ^= u[j];
      }
    }

    // Copy result block into derived key
    const offset = (blockIndex - 1) * 32;
    const copyLength = Math.min(32, keyLength - offset);
    derivedKey.set(resultBlock.slice(0, copyLength), offset);
  }

  return derivedKey;
}

// ========================================
// Utility Functions
// ========================================

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  // Chunk-based encoding to avoid memory issues with large data
  const chunkSize = 8192;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    let binary = '';
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
    chunks.push(btoa(binary));
  }
  return chunks.join('');
}

function base64ToUint8Array(base64: string): Uint8Array {
  // Pure JS implementation — works in all React Native versions
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

function padData(data: Uint8Array): Uint8Array {
  // PKCS7 padding
  const blockSize = 16;
  const paddingLength = blockSize - (data.length % blockSize);
  const paddedData = new Uint8Array(data.length + paddingLength);
  paddedData.set(data);
  for (let i = data.length; i < paddedData.length; i++) {
    paddedData[i] = paddingLength;
  }
  return paddedData;
}

function removePadding(data: Uint8Array): Uint8Array {
  if (data.length === 0) return data;
  const paddingLength = data[data.length - 1];
  if (paddingLength > 16 || paddingLength === 0) return data;
  // Verify all padding bytes
  for (let i = data.length - paddingLength; i < data.length; i++) {
    if (data[i] !== paddingLength) return data;
  }
  return data.slice(0, data.length - paddingLength);
}

function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] ^ b[i];
  }
  return result;
}

// ========================================
// Encryption Operations
// ========================================

/**
 * Generate a cryptographically secure random AES-256 key.
 */
export function generateAESKey(): Uint8Array {
  return Crypto.getRandomBytes(AES_KEY_LENGTH);
}

/**
 * Generate a random initialization vector (IV).
 */
export function generateIV(): Uint8Array {
  return Crypto.getRandomBytes(IV_LENGTH);
}

/**
 * Generate a random salt for PBKDF2.
 */
export function generateSalt(): Uint8Array {
  return Crypto.getRandomBytes(SALT_LENGTH);
}

/**
 * Encrypt data using AES-256-CBC.
 * @param data - Plaintext data as Uint8Array
 * @param key - 32-byte AES key
 * @param iv - 16-byte initialization vector
 * @returns Encrypted data as Uint8Array (includes PKCS7 padding)
 */
export function encryptAES(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  logger.debug(TAG, `Encrypting ${data.length} bytes with AES-256-CBC`);

  const paddedData = padData(data);
  const aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
  const encryptedBytes = aesCbc.encrypt(paddedData);

  return new Uint8Array(encryptedBytes);
}

/**
 * Decrypt data using AES-256-CBC.
 * @param encryptedData - Ciphertext as Uint8Array
 * @param key - 32-byte AES key
 * @param iv - 16-byte initialization vector
 * @returns Decrypted data as Uint8Array (padding removed)
 */
export function decryptAES(encryptedData: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  logger.debug(TAG, `Decrypting ${encryptedData.length} bytes with AES-256-CBC`);

  const aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
  const decryptedBytes = aesCbc.decrypt(encryptedData);

  return removePadding(new Uint8Array(decryptedBytes));
}

/**
 * Encrypt an AES key with a master key using XOR + AES.
 * This is a simplified approach: encrypt the random AES key using the master key.
 */
export function encryptKeyWithMasterKey(
  aesKey: Uint8Array,
  masterKey: Uint8Array,
): Uint8Array {
  // Use AES-ECB for key encryption (single block, no padding needed for 32-byte key)
  // We split into two 16-byte blocks and encrypt each
  const aesEcb = new aesjs.ModeOfOperation.ecb(masterKey);
  const encrypted = aesEcb.encrypt(aesKey);
  return new Uint8Array(encrypted);
}

/**
 * Decrypt an AES key that was encrypted with a master key.
 */
export function decryptKeyWithMasterKey(
  encryptedKey: Uint8Array,
  masterKey: Uint8Array,
): Uint8Array {
  const aesEcb = new aesjs.ModeOfOperation.ecb(masterKey);
  const decrypted = aesEcb.decrypt(encryptedKey);
  return new Uint8Array(decrypted);
}

/**
 * Derive the master key from a password and salt.
 */
export async function deriveMasterKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  logger.info(TAG, 'Deriving master key from password (this may take a moment)...');
  const startTime = Date.now();

  const masterKey = await pbkdf2(password, salt, PBKDF2_ITERATIONS, AES_KEY_LENGTH);

  const duration = Date.now() - startTime;
  logger.info(TAG, `Master key derived in ${duration}ms`);

  return masterKey;
}

// ========================================
// High-Level Operations
// ========================================

/**
 * Encrypt a file for upload to IPFS.
 *
 * This function:
 * 1. Generates a random AES-256 key and IV
 * 2. Encrypts the file data with the AES key
 * 3. Encrypts the AES key with the master key (derived from password)
 * 4. Returns all components needed for decryption later
 *
 * @param fileData - Raw file data as Uint8Array
 * @param masterKey - The password-derived master key
 * @returns EncryptionResult with encrypted data, encrypted key, and IV (all base64)
 */
export function encryptFile(fileData: Uint8Array, masterKey: Uint8Array): EncryptionResult {
  logger.info(TAG, `Encrypting file (${fileData.length} bytes)`);
  const startTime = Date.now();

  // Generate random key and IV
  const aesKey = generateAESKey();
  const iv = generateIV();

  // Encrypt file data
  const encryptedData = encryptAES(fileData, aesKey, iv);

  // Encrypt the AES key with master key
  const encryptedKey = encryptKeyWithMasterKey(aesKey, masterKey);

  const duration = Date.now() - startTime;
  logger.info(TAG, `File encrypted in ${duration}ms (${encryptedData.length} bytes)`);

  return {
    encryptedData: uint8ArrayToBase64(encryptedData),
    encryptedKey: uint8ArrayToBase64(encryptedKey),
    iv: uint8ArrayToBase64(iv),
  };
}

/**
 * Decrypt a file downloaded from IPFS.
 *
 * @param encryptedDataB64 - Base64-encoded encrypted file data
 * @param encryptedKeyB64 - Base64-encoded encrypted AES key
 * @param ivB64 - Base64-encoded initialization vector
 * @param masterKey - The password-derived master key
 * @returns Decrypted file data as Uint8Array
 */
export function decryptFile(
  encryptedDataB64: string,
  encryptedKeyB64: string,
  ivB64: string,
  masterKey: Uint8Array,
): Uint8Array {
  logger.info(TAG, `Decrypting file (encrypted size: ${encryptedDataB64.length} chars)`);
  const startTime = Date.now();

  // Decode from base64
  const encryptedData = base64ToUint8Array(encryptedDataB64);
  const encryptedKey = base64ToUint8Array(encryptedKeyB64);
  const iv = base64ToUint8Array(ivB64);

  // Decrypt AES key using master key
  const aesKey = decryptKeyWithMasterKey(encryptedKey, masterKey);

  // Decrypt file data
  const decryptedData = decryptAES(encryptedData, aesKey, iv);

  const duration = Date.now() - startTime;
  logger.info(TAG, `File decrypted in ${duration}ms (${decryptedData.length} bytes)`);

  return decryptedData;
}

// ========================================
// Password Management
// ========================================

interface StoredCredential {
  salt: string; // hex
  verifier: string; // hex
}

/**
 * Set up encryption for a new user.
 * Generates a salt, derives a master key, and stores a verifier for password validation.
 *
 * @param password - User's master password
 * @returns The generated salt and derived master key
 */
export async function setupEncryption(password: string): Promise<{ salt: Uint8Array; masterKey: Uint8Array }> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  // Generate salt
  const salt = generateSalt();

  // Derive master key
  const masterKey = await deriveMasterKey(password, salt);

  // Create a verifier: hash of (salt + masterKey)
  const verifierInput = new Uint8Array(salt.length + masterKey.length);
  verifierInput.set(salt);
  verifierInput.set(masterKey, salt.length);
  const verifier = await sha256(bytesToHex(verifierInput));

  // Store salt and verifier
  const stored: StoredCredential = {
    salt: bytesToHex(salt),
    verifier: verifier,
  };

  await AsyncStorage.setItem(STORAGE_KEYS.ENCRYPTION_SALT, JSON.stringify(stored));

  logger.info(TAG, 'Encryption setup complete. Salt and verifier stored.');

  return { salt, masterKey };
}

/**
 * Verify a password against the stored verifier.
 *
 * @param password - User's master password to verify
 * @returns The derived master key if password is correct, throws if not
 */
export async function verifyPassword(password: string): Promise<Uint8Array> {
  const storedJson = await AsyncStorage.getItem(STORAGE_KEYS.ENCRYPTION_SALT);

  if (!storedJson) {
    throw new Error('Encryption not set up. Please create a password first.');
  }

  const stored: StoredCredential = JSON.parse(storedJson);
  const salt = hexToBytes(stored.salt);

  // Derive master key from provided password
  const masterKey = await deriveMasterKey(password, salt);

  // Verify by re-computing the verifier
  const verifierInput = new Uint8Array(salt.length + masterKey.length);
  verifierInput.set(salt);
  verifierInput.set(masterKey, salt.length);
  const computedVerifier = await sha256(bytesToHex(verifierInput));

  // Constant-time comparison
  if (!timingSafeEqual(stored.verifier, computedVerifier)) {
    throw new Error('Incorrect password. Please try again.');
  }

  logger.info(TAG, 'Password verified successfully.');
  return masterKey;
}

/**
 * Check if encryption has been set up (salt exists in storage).
 */
export async function isEncryptionSetup(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(STORAGE_KEYS.ENCRYPTION_SALT);
  return stored !== null;
}

/**
 * Reset encryption (delete stored salt and verifier).
 * WARNING: This will make previously encrypted files unrecoverable!
 */
export async function resetEncryption(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.ENCRYPTION_SALT);
  logger.warn(TAG, 'Encryption reset. All previously encrypted files are now unrecoverable.');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
