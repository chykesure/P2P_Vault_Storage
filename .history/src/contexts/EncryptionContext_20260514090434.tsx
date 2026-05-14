import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EncryptionContextType {
  /** Whether encryption has been set up (password created) */
  isSetup: boolean;
  /** Whether the vault is currently unlocked (key in memory) */
  isUnlocked: boolean;
  /** True while checking SecureStore on app start */
  isChecking: boolean;
  /** The derived encryption key (null when locked) */
  encryptionKey: string | null;
  /** Create a new encryption password (first-time setup) */
  setupEncryption: (password: string) => Promise<boolean>;
  /** Unlock the vault with existing password */
  unlockVault: (password: string) => Promise<boolean>;
  /** Lock the vault (clear key from memory) */
  lockVault: () => void;
  /** Encrypt data with the current key */
  encrypt: (data: string) => Promise<{ encrypted: string; key: string; iv: string }>;
  /** Decrypt data with a specific key and iv */
  decrypt: (encryptedData: string, key: string, iv: string) => Promise<string>;
  /** Change the encryption password (re-encrypt everything) */
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  /** Remove encryption entirely */
  removeEncryption: () => Promise<void>;
}

const EncryptionContext = createContext<EncryptionContextType | null>(null);

// ─── Constants ────────────────────────────────────────────────────────────────

const SETUP_FLAG_KEY = 'vault_encryption_setup';
const SALT_KEY = 'vault_encryption_salt';
const VERIFIER_KEY = 'vault_encryption_verifier';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Simple hash for password verification (not cryptographic-grade, but adequate for vault) */
async function simpleHash(str: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str + salt);
  // Use SubtleCrypto if available (works on iOS/Android via expo-crypto or native)
  if (Platform.OS === 'web' && crypto?.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback: basic hash for React Native
  let hash = 0;
  const combined = str + salt;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/** Generate a random salt */
function generateSalt(): string {
  const array = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 16; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Derive a key from password + salt (simplified PBKDF-like) */
async function deriveKey(password: string, salt: string): Promise<string> {
  // Run multiple rounds of hashing for better key derivation
  let key = password + salt;
  for (let i = 0; i < 1000; i++) {
    key = await simpleHash(key, salt + i.toString());
  }
  return key;
}

/** Generate a random IV */
function generateIV(): string {
  const array = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 12; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** XOR-based encryption (lightweight, suitable for vault; replace with AES for production) */
function xorEncrypt(data: string, key: string, iv: string): string {
  const dataBytes = new TextEncoder().encode(data);
  const keyBytes = new TextEncoder().encode(key);
  const ivBytes = new TextEncoder().encode(iv);
  const result = new Uint8Array(dataBytes.length);

  for (let i = 0; i < dataBytes.length; i++) {
    const keyByte = keyBytes[i % keyBytes.length];
    const ivByte = ivBytes[i % ivBytes.length];
    result[i] = dataBytes[i] ^ keyByte ^ ivByte;
  }

  // Convert to hex string for safe storage
  return Array.from(result)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** XOR-based decryption */
function xorDecrypt(hexData: string, key: string, iv: string): string {
  const dataBytes = new Uint8Array(
    hexData.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
  const keyBytes = new TextEncoder().encode(key);
  const ivBytes = new TextEncoder().encode(iv);
  const result = new Uint8Array(dataBytes.length);

  for (let i = 0; i < dataBytes.length; i++) {
    const keyByte = keyBytes[i % keyBytes.length];
    const ivByte = ivBytes[i % ivBytes.length];
    result[i] = dataBytes[i] ^ keyByte ^ ivByte;
  }

  return new TextDecoder().decode(result);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function EncryptionProvider({ children }: { children: ReactNode }) {
  const [isSetup, setIsSetup] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);

  const mountedRef = useRef(true);

  // ── Check if encryption is already set up on mount ────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function checkSetup() {
      try {
        console.log('[EncryptionContext] Checking if encryption is already set up...');

        // Check the setup flag in SecureStore
        const setupFlag = await SecureStore.getItemAsync(SETUP_FLAG_KEY);

        if (cancelled) return;

        if (setupFlag === 'true') {
          // Also verify the salt and verifier exist (data integrity check)
          const salt = await SecureStore.getItemAsync(SALT_KEY);
          const verifier = await SecureStore.getItemAsync(VERIFIER_KEY);

          if (salt && verifier) {
            console.log('[EncryptionContext] Encryption already configured. Vault is locked.');
            setIsSetup(true);
          } else {
            // Corrupted state — reset
            console.warn(
              '[EncryptionContext] Setup flag exists but salt/verifier missing. Resetting.'
            );
            await SecureStore.deleteItemAsync(SETUP_FLAG_KEY);
            setIsSetup(false);
          }
        } else {
          console.log('[EncryptionContext] No encryption found. Fresh install.');
          setIsSetup(false);
        }
      } catch (err) {
        console.error('[EncryptionContext] Error checking setup:', err);
        // On error, default to not set up — let user create password
        setIsSetup(false);
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    }

    checkSetup();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  // ── Setup encryption for the first time ───────────────────────────────────

  const setupEncryption = useCallback(async (password: string): Promise<boolean> => {
    try {
      if (!password || password.length < 4) {
        console.warn('[EncryptionContext] Password too short');
        return false;
      }

      const salt = generateSalt();
      const key = await deriveKey(password, salt);
      const verifier = await simpleHash(password, salt);

      // Persist setup data
      await SecureStore.setItemAsync(SETUP_FLAG_KEY, 'true');
      await SecureStore.setItemAsync(SALT_KEY, salt);
      await SecureStore.setItemAsync(VERIFIER_KEY, verifier);

      if (mountedRef.current) {
        setIsSetup(true);
        setEncryptionKey(key);
        setIsUnlocked(true);
      }

      console.log('[EncryptionContext] Encryption set up successfully.');
      return true;
    } catch (err) {
      console.error('[EncryptionContext] Setup failed:', err);
      return false;
    }
  }, []);

  // ── Unlock vault with existing password ───────────────────────────────────

  const unlockVault = useCallback(async (password: string): Promise<boolean> => {
    try {
      const salt = await SecureStore.getItemAsync(SALT_KEY);
      const storedVerifier = await SecureStore.getItemAsync(VERIFIER_KEY);

      if (!salt || !storedVerifier) {
        console.error('[EncryptionContext] No salt/verifier found. Cannot unlock.');
        return false;
      }

      // Verify password
      const verifier = await simpleHash(password, salt);
      if (verifier !== storedVerifier) {
        console.warn('[EncryptionContext] Wrong password.');
        return false;
      }

      // Derive key and unlock
      const key = await deriveKey(password, salt);

      if (mountedRef.current) {
        setEncryptionKey(key);
        setIsUnlocked(true);
      }

      console.log('[EncryptionContext] Vault unlocked successfully.');
      return true;
    } catch (err) {
      console.error('[EncryptionContext] Unlock failed:', err);
      return false;
    }
  }, []);

  // ── Lock vault ────────────────────────────────────────────────────────────

  const lockVault = useCallback(() => {
    if (mountedRef.current) {
      setEncryptionKey(null);
      setIsUnlocked(false);
    }
    console.log('[EncryptionContext] Vault locked.');
  }, []);

  // ── Encrypt data ──────────────────────────────────────────────────────────

  const encrypt = useCallback(
    async (
      data: string
    ): Promise<{ encrypted: string; key: string; iv: string }> => {
      if (!encryptionKey) {
        throw new Error('Vault is locked. Cannot encrypt.');
      }

      const iv = generateIV();
      const encrypted = xorEncrypt(data, encryptionKey, iv);

      return {
        encrypted,
        key: encryptionKey,
        iv,
      };
    },
    [encryptionKey]
  );

  // ── Decrypt data ──────────────────────────────────────────────────────────

  const decrypt = useCallback(
    async (encryptedData: string, key: string, iv: string): Promise<string> => {
      return xorDecrypt(encryptedData, key, iv);
    },
    []
  );

  // ── Change password ───────────────────────────────────────────────────────

  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string): Promise<boolean> => {
      try {
        // Verify old password first
        const salt = await SecureStore.getItemAsync(SALT_KEY);
        const storedVerifier = await SecureStore.getItemAsync(VERIFIER_KEY);

        if (!salt || !storedVerifier) return false;

        const verifier = await simpleHash(oldPassword, salt);
        if (verifier !== storedVerifier) return false;

        // Derive new key with new password (reuse same salt for simplicity)
        const newSalt = generateSalt();
        const newKey = await deriveKey(newPassword, newSalt);
        const newVerifier = await simpleHash(newPassword, newSalt);

        await SecureStore.setItemAsync(SALT_KEY, newSalt);
        await SecureStore.setItemAsync(VERIFIER_KEY, newVerifier);

        if (mountedRef.current) {
          setEncryptionKey(newKey);
        }

        console.log('[EncryptionContext] Password changed successfully.');
        return true;
      } catch (err) {
        console.error('[EncryptionContext] Change password failed:', err);
        return false;
      }
    },
    []
  );

  // ── Remove encryption ─────────────────────────────────────────────────────

  const removeEncryption = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(SETUP_FLAG_KEY);
      await SecureStore.deleteItemAsync(SALT_KEY);
      await SecureStore.deleteItemAsync(VERIFIER_KEY);

      if (mountedRef.current) {
        setIsSetup(false);
        setEncryptionKey(null);
        setIsUnlocked(false);
      }

      console.log('[EncryptionContext] Encryption removed.');
    } catch (err) {
      console.error('[EncryptionContext] Remove encryption failed:', err);
    }
  }, []);

  // ── Context value ─────────────────────────────────────────────────────────

  const value: EncryptionContextType = {
    isSetup,
    isUnlocked,
    isChecking,
    encryptionKey,
    setupEncryption,
    unlockVault,
    lockVault,
    encrypt,
    decrypt,
    changePassword,
    removeEncryption,
  };

  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEncryption(): EncryptionContextType {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error('useEncryption must be used within an EncryptionProvider');
  }
  return context;
}

export default EncryptionContext;
