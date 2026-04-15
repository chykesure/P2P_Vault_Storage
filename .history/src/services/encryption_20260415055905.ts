/**
 * Encryption Service
 *
 * Handles all cryptographic operations for the P2P Storage Vault.
 * Uses AES-256-CBC for file encryption and PBKDF2 for key derivation
 * from the user's master password.
 *
 * Performance: SHA-256 and HMAC are implemented in pure JS to avoid
 * the overhead of 20,000+ async React Native bridge calls per PBKDF2.
 */

import aesjs from 'aes-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

// ========================================
// Pure JS SHA-256 (zero bridge calls)
// ========================================

// SHA-256 constants (first 32 bits of the fractional parts of cube roots of first 64 primes)
const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rightRotate(value: number, amount: number): number {
  return ((value >>> amount) | (value << (32 - amount))) >>> 0;
}

/**
 * Pure JS SHA-256 hash.
 * Takes a Uint8Array and returns a 32-byte Uint8Array hash.
 * Runs entirely in JavaScript — no native bridge calls.
 */
function sha256Bytes(data: Uint8Array): Uint8Array {
  // Pre-processing: adding padding bits
  const msgLen = data.length;
  const bitLen = msgLen * 8;

  // Pad to 56 mod 64 bytes, then add 8-byte length
  const padLen = ((56 - (msgLen + 1) % 64) + 64) % 64;
  const totalLen = msgLen + 1 + padLen + 8;

  const buf = new Uint8Array(totalLen);
  buf.set(data);
  buf[msgLen] = 0x80;

  // Append bit length as 64-bit big-endian
  // JavaScript bitwise ops are 32-bit, so split into two 32-bit writes
  buf[totalLen - 4] = (bitLen >>> 24) & 0xff;
  buf[totalLen - 3] = (bitLen >>> 16) & 0xff;
  buf[totalLen - 2] = (bitLen >>> 8) & 0xff;
  buf[totalLen - 1] = bitLen & 0xff;

  // Initialize hash values
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  // Process each 512-bit (64-byte) block
  const w = new Int32Array(64);

  for (let offset = 0; offset < totalLen; offset += 64) {
    // Create message schedule
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      w[i] = (buf[j] << 24) | (buf[j + 1] << 16) | (buf[j + 2] << 8) | buf[j + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    // Working variables
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    // Compression
    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K256[i] + w[i]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  // Produce the final hash value (big-endian)
  const hash = new Uint8Array(32);
  const view = new DataView(hash.buffer);
  view.setUint32(0, h0, false);
  view.setUint32(4, h1, false);
  view.setUint32(8, h2, false);
  view.setUint32(12, h3, false);
  view.setUint32(16, h4, false);
  view.setUint32(20, h5, false);
  view.setUint32(24, h6, false);
  view.setUint32(28, h7, false);

  return hash;
}

/**
 * SHA-256 hash returning hex string (uses expo-crypto for non-PBKDF2 calls).
 */
async function sha256(hexString: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, hexString);
}

// ========================================
// PBKDF2 Implementation (Pure JS, Synchronous)
// ========================================

/**
 * HMAC-SHA256 — pure JS, synchronous.
 * No native bridge calls. Runs entirely in JavaScript.
 */
function hmacSha256Sync(key: Uint8Array, message: Uint8Array): Uint8Array {
  const blockSize = 64;
  const keyPadded = new Uint8Array(blockSize);

  if (key.length > blockSize) {
    const keyHash = sha256Bytes(key);
    keyPadded.set(keyHash);
  } else {
    keyPadded.set(key);
  }

  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);

  for (let i = 0; i < blockSize; i++) {
    ipad[i] = keyPadded[i] ^ 0x36;
    opad[i] = keyPadded[i] ^ 0x5c;
  }

  // Inner hash: SHA256(ipad || message)
  const innerData = new Uint8Array(blockSize + message.length);
  innerData.set(ipad);
  innerData.set(message, blockSize);
  const innerHash = sha256Bytes(innerData);

  // Outer hash: SHA256(opad || innerHash)
  const outerData = new Uint8Array(blockSize + 32);
  outerData.set(opad);
  outerData.set(innerHash, blockSize);
  return sha256Bytes(outerData);
}

/**
 * PBKDF2-HMAC-SHA256 key derivation — pure JS, synchronous.
 * Derives a key of the specified length from password + salt.
 *
 * With pure JS SHA-256, this runs 10,000 iterations in ~200-500ms
 * instead of 20+ seconds with async native bridge calls.
 */
export function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
  keyLength: number,
): Uint8Array {
  const passwordBytes = new TextEncoder().encode(password);
  const blockCount = Math.ceil(keyLength / 32);
  const derivedKey = new Uint8Array(keyLength);

  for (let blockIndex = 1; blockIndex <= blockCount; blockIndex++) {
    // U1 = HMAC(password, salt || INT_32_BE(blockIndex))
    const blockIndexBytes = new Uint8Array(4);
    new DataView(blockIndexBytes.buffer).setUint32(0, blockIndex, false);

    const saltWithBlock = new Uint8Array(salt.length + 4);
    saltWithBlock.set(salt);
    saltWithBlock.set(blockIndexBytes, salt.length);

    let u = hmacSha256Sync(passwordBytes, saltWithBlock);
    const resultBlock = new Uint8Array(u);

    // U2 ... Uc
    for (let i = 1; i < iterations; i++) {
      u = hmacSha256Sync(passwordBytes, u);
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
  for (let i = data.length - paddingLength; i < data.length; i++) {
    if (data[i] !== paddingLength) return data;
  }
  return data.slice(0, data.length - paddingLength);
}

// ========================================
// Encryption Operations
// ========================================

export function generateAESKey(): Uint8Array {
  return Crypto.getRandomBytes(AES_KEY_LENGTH);
}

export function generateIV(): Uint8Array {
  return Crypto.getRandomBytes(IV_LENGTH);
}

export function generateSalt(): Uint8Array {
  return Crypto.getRandomBytes(SALT_LENGTH);
}

export function encryptAES(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  logger.debug(TAG, `Encrypting ${data.length} bytes with AES-256-CBC`);
  const paddedData = padData(data);
  const aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
  const encryptedBytes = aesCbc.encrypt(paddedData);
  return new Uint8Array(encryptedBytes);
}

export function decryptAES(encryptedData: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  logger.debug(TAG, `Decrypting ${encryptedData.length} bytes with AES-256-CBC`);
  const aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
  const decryptedBytes = aesCbc.decrypt(encryptedData);
  return removePadding(new Uint8Array(decryptedBytes));
}

export function encryptKeyWithMasterKey(
  aesKey: Uint8Array,
  masterKey: Uint8Array,
): Uint8Array {
  const aesEcb = new aesjs.ModeOfOperation.ecb(masterKey);
  const encrypted = aesEcb.encrypt(aesKey);
  return new Uint8Array(encrypted);
}

export function decryptKeyWithMasterKey(
  encryptedKey: Uint8Array,
  masterKey: Uint8Array,
): Uint8Array {
  const aesEcb = new aesjs.ModeOfOperation.ecb(masterKey);
  const decrypted = aesEcb.decrypt(encryptedKey);
  return new Uint8Array(decrypted);
}

/**
 * Derive master key from password and salt.
 * Now uses synchronous pure-JS PBKDF2 — completes in ~200-500ms.
 */
export function deriveMasterKey(password: string, salt: Uint8Array): Uint8Array {
  logger.info(TAG, 'Deriving master key from password...');
  const startTime = Date.now();

  const masterKey = pbkdf2(password, salt, PBKDF2_ITERATIONS, AES_KEY_LENGTH);

  const duration = Date.now() - startTime;
  logger.info(TAG, `Master key derived in ${duration}ms`);

  return masterKey;
}

// ========================================
// High-Level Operations
// ========================================

export function encryptFile(fileData: Uint8Array, masterKey: Uint8Array): EncryptionResult {
  logger.info(TAG, `Encrypting file (${fileData.length} bytes)`);
  const startTime = Date.now();

  const aesKey = generateAESKey();
  const iv = generateIV();
  const encryptedData = encryptAES(fileData, aesKey, iv);
  const encryptedKey = encryptKeyWithMasterKey(aesKey, masterKey);

  const duration = Date.now() - startTime;
  logger.info(TAG, `File encrypted in ${duration}ms (${encryptedData.length} bytes)`);

  return {
    encryptedData: uint8ArrayToBase64(encryptedData),
    encryptedKey: uint8ArrayToBase64(encryptedKey),
    iv: uint8ArrayToBase64(iv),
  };
}

export function decryptFile(
  encryptedDataB64: string,
  encryptedKeyB64: string,
  ivB64: string,
  masterKey: Uint8Array,
): Uint8Array {
  logger.info(TAG, `Decrypting file (encrypted size: ${encryptedDataB64.length} chars)`);
  const startTime = Date.now();

  const encryptedData = base64ToUint8Array(encryptedDataB64);
  const encryptedKey = base64ToUint8Array(encryptedKeyB64);
  const iv = base64ToUint8Array(ivB64);
  const aesKey = decryptKeyWithMasterKey(encryptedKey, masterKey);
  const decryptedData = decryptAES(encryptedData, aesKey, iv);

  const duration = Date.now() - startTime;
  logger.info(TAG, `File decrypted in ${duration}ms (${decryptedData.length} bytes)`);

  return decryptedData;
}

// ========================================
// Password Management
// ========================================

interface StoredCredential {
  salt: string;
  verifier: string;
}

export async function setupEncryption(password: string): Promise<{ salt: Uint8Array; masterKey: Uint8Array }> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  const salt = generateSalt();
  const masterKey = deriveMasterKey(password, salt);

  // Verifier using pure JS SHA-256
  const verifierInput = new Uint8Array(salt.length + masterKey.length);
  verifierInput.set(salt);
  verifierInput.set(masterKey, salt.length);
  const verifierHash = sha256Bytes(verifierInput);
  const verifier = bytesToHex(verifierHash);

  const stored: StoredCredential = {
    salt: bytesToHex(salt),
    verifier: verifier,
  };

  await AsyncStorage.setItem(STORAGE_KEYS.ENCRYPTION_SALT, JSON.stringify(stored));

  logger.info(TAG, 'Encryption setup complete.');

  return { salt, masterKey };
}

export async function verifyPassword(password: string): Promise<Uint8Array> {
  const storedJson = await AsyncStorage.getItem(STORAGE_KEYS.ENCRYPTION_SALT);

  if (!storedJson) {
    throw new Error('Encryption not set up. Please create a password first.');
  }

  const stored: StoredCredential = JSON.parse(storedJson);
  const salt = hexToBytes(stored.salt);

  // Derive master key — synchronous now, ~200-500ms
  const masterKey = deriveMasterKey(password, salt);

  // Verify using pure JS SHA-256
  const verifierInput = new Uint8Array(salt.length + masterKey.length);
  verifierInput.set(salt);
  verifierInput.set(masterKey, salt.length);
  const verifierHash = sha256Bytes(verifierInput);
  const computedVerifier = bytesToHex(verifierHash);

  if (!timingSafeEqual(stored.verifier, computedVerifier)) {
    throw new Error('Incorrect password. Please try again.');
  }

  logger.info(TAG, 'Password verified successfully.');
  return masterKey;
}

export async function isEncryptionSetup(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(STORAGE_KEYS.ENCRYPTION_SALT);
  return stored !== null;
}

export async function resetEncryption(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.ENCRYPTION_SALT);
  logger.warn(TAG, 'Encryption reset.');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}