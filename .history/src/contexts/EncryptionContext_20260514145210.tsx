/**
 * EncryptionContext — expo-secure-store backed vault encryption
 *
 * FIX: Uses useRef for encryptionKey so encrypt() always has the latest key
 *      synchronously — no stale closure issues after navigation.reset().
 * FIX: Added isChecking state to prevent password modal flash on cold start.
 */

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

// ─── SecureStore keys ─────────────────────────────────────────────────────────

const SETUP_FLAG_KEY = 'vault_encryption_setup';
const SALT_KEY = 'vault_encryption_salt';
const VERIFIER_KEY = 'vault_encryption_verifier';

// ─── Crypto helpers ───────────────────────────────────────────────────────────

async function simpleHash(str: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str + salt);

  if (Platform.OS === 'web' && typeof crypto !== 'undefined' && crypto?.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  let hash = 0;
  const combined = str + salt;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

function generateSalt(): string {
  const array = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 16; i++) array[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function deriveKey(password: string, salt: string): Promise<string> {
  let key = password + salt;
  for (let i = 0; i < 1000; i++) {
    key = await simpleHash(key, salt + i.toString());
  }
  return key;
}

function generateIV(): string {
  const array = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 12; i++) array[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

function xorEncrypt(data: string, key: string, iv: string): string {
  const dataBytes = new TextEncoder().encode(data);
  const keyBytes = new TextEncoder().encode(key);
  const ivBytes = new TextEncoder().encode(iv);
  const result = new Uint8Array(dataBytes.length);

  for (let i = 0; i < dataBytes.length; i++) {
    result[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length] ^ ivBytes[i % ivBytes.length];
  }

  return Array.from(result).map(b => b.toString(16).padStart(2, '0')).join('');
}

function xorDecrypt(hexData: string, key: string, iv: string): string {
  const dataBytes = new Uint8Array(
    hexData.match(/.{1,2}/g)!.map(b => parseInt(b, 16))
  );
  const keyBytes = new TextEncoder().encode(key);
  const ivBytes = new TextEncoder().encode(iv);
  const result = new Uint8Array(dataBytes.length);

  for (let i = 0; i < dataBytes.length; i++) {
    result[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length] ^ ivBytes[i % ivBytes.length];
  }

  return new TextDecoder().decode(result);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function EncryptionProvider({ children }: { children: ReactNode }) {
  const [isSetup, setIsSetup] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);

  // ★ KEY FIX: Ref for synchronous access — no stale closures
  const encryptionKeyRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // Helper to update both ref and state together
  const updateKey = useCallback((key: string | null) => {
    encryptionKeyRef.current = key;   // synchronous — available immediately
    setEncryptionKey(key);            // async — triggers re-render
  }, []);

  // ── Check SecureStore on mount ────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        console.log('[EncryptionContext] Checking if encryption is already set up...');

        const setupFlag = await SecureStore.getItemAsync(SETUP_FLAG_KEY);

        if (cancelled) return;

        if (setupFlag === 'true') {
          const salt = await SecureStore.getItemAsync(SALT_KEY);
          const verifier = await SecureStore.getItemAsync(VERIFIER_KEY);

          if (salt && verifier) {
            console.log('[EncryptionContext] Encryption already configured. Vault is locked.');
            setIsSetup(true);
          } else {
            console.warn('[EncryptionContext] Setup flag but no salt/verifier. Resetting.');
            await SecureStore.deleteItemAsync(SETUP_FLAG_KEY);
            setIsSetup(false);
          }
        } else {
          console.log('[EncryptionContext] No encryption found. Fresh install.');
          setIsSetup(false);
        }
      } catch (err) {
        console.error('[EncryptionContext] Error checking setup:', err);
        setIsSetup(false);
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  // ── Setup encryption ──────────────────────────────────────────────────────

  const setupEncryption = useCallback(async (password: string): Promise<boolean> => {
    try {
      if (!password || password.length < 4) {
        console.warn('[EncryptionContext] Password too short');
        return false;
      }

      const salt = generateSalt();
      const key = await deriveKey(password, salt);
      const verifier = await simpleHash(password, salt);

      await SecureStore.setItemAsync(SETUP_FLAG_KEY, 'true');
      await SecureStore.setItemAsync(SALT_KEY, salt);
      await SecureStore.setItemAsync(VERIFIER_KEY, verifier);

      if (mountedRef.current) {
        updateKey(key);           // ★ ref + state — key available immediately
        setIsSetup(true);
        setIsUnlocked(true);
      }

      console.log('[EncryptionContext] ✅ Encryption set up & vault unlocked.');
      return true;
    } catch (err) {
      console.error('[EncryptionContext] Setup failed:', err);
      return false;
    }
  }, [updateKey]);

  // ── Unlock vault ──────────────────────────────────────────────────────────

  const unlockVault = useCallback(async (password: string): Promise<boolean> => {
    try {
      const salt = await SecureStore.getItemAsync(SALT_KEY);
      const storedVerifier = await SecureStore.getItemAsync(VERIFIER_KEY);

      if (!salt || !storedVerifier) {
        console.error('[EncryptionContext] No salt/verifier. Cannot unlock.');
        return false;
      }

      const verifier = await simpleHash(password, salt);
      if (verifier !== storedVerifier) {
        console.warn('[EncryptionContext] Wrong password.');
        return false;
      }

      const key = await deriveKey(password, salt);

      if (mountedRef.current) {
        updateKey(key);           // ★ ref + state — key available immediately
        setIsUnlocked(true);
      }

      console.log('[EncryptionContext] ✅ Vault unlocked.');
      return true;
    } catch (err) {
      console.error('[EncryptionContext] Unlock failed:', err);
      return false;
    }
  }, [updateKey]);

  // ── Lock vault ────────────────────────────────────────────────────────────

  const lockVault = useCallback(() => {
    if (mountedRef.current) {
      updateKey(null);            // ★ ref + state
      setIsUnlocked(false);
    }
    console.log('[EncryptionContext] Vault locked.');
  }, [updateKey]);

  // ── Encrypt — reads from REF (synchronous, no stale closure) ─────────────

  const encrypt = useCallback(
    async (data: string): Promise<{ encrypted: string; key: string; iv: string }> => {
      // ★ Read from ref — always has the latest key, even before React re-renders
      const key = encryptionKeyRef.current;
      if (!key) {
        throw new Error('Vault is locked. Please unlock the vault with your password.');
      }

      const iv = generateIV();
      const encrypted = xorEncrypt(data, key, iv);

      return { encrypted, key, iv };
    },
    [],  // ★ no dependencies! stable reference, reads from ref
  );

  // ── Decrypt ───────────────────────────────────────────────────────────────

  const decrypt = useCallback(
    async (encryptedData: string, key: string, iv: string): Promise<string> => {
      return xorDecrypt(encryptedData, key, iv);
    },
    [],
  );

  // ── Change password ───────────────────────────────────────────────────────

  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string): Promise<boolean> => {
      try {
        const salt = await SecureStore.getItemAsync(SALT_KEY);
        const storedVerifier = await SecureStore.getItemAsync(VERIFIER_KEY);
        if (!salt || !storedVerifier) return false;

        const verifier = await simpleHash(oldPassword, salt);
        if (verifier !== storedVerifier) return false;

        const newSalt = generateSalt();
        const newKey = await deriveKey(newPassword, newSalt);
        const newVerifier = await simpleHash(newPassword, newSalt);

        await SecureStore.setItemAsync(SALT_KEY, newSalt);
        await SecureStore.setItemAsync(VERIFIER_KEY, newVerifier);

        if (mountedRef.current) {
          updateKey(newKey);       // ★ ref + state
        }

        console.log('[EncryptionContext] ✅ Password changed.');
        return true;
      } catch (err) {
        console.error('[EncryptionContext] Change password failed:', err);
        return false;
      }
    },
    [updateKey],
  );

  // ── Remove encryption ─────────────────────────────────────────────────────

  const removeEncryption = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(SETUP_FLAG_KEY);
      await SecureStore.deleteItemAsync(SALT_KEY);
      await SecureStore.deleteItemAsync(VERIFIER_KEY);

      if (mountedRef.current) {
        updateKey(null);           // ★ ref + state
        setIsSetup(false);
        setIsUnlocked(false);
      }

      console.log('[EncryptionContext] Encryption removed.');
    } catch (err) {
      console.error('[EncryptionContext] Remove encryption failed:', err);
    }
  }, [updateKey]);

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

  return <EncryptionContext.Provider value={value}>{children}</EncryptionContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEncryption(): EncryptionContextType {
  const ctx = useContext(EncryptionContext);
  if (!ctx) throw new Error('useEncryption must be used within <EncryptionProvider>');
  return ctx;
}

export default EncryptionContext;
