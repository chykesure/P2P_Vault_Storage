/**
 * Encryption Context
 *
 * Manages the encryption lifecycle:
 * - Password setup on first launch
 * - Password verification on subsequent launches
 * - Master key management (kept in memory only, never persisted)
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

import {
  setupEncryption,
  verifyPassword,
  isEncryptionSetup,
  resetEncryption,
  encryptFile,
  decryptFile,
} from '@services/encryption';
import { EncryptionResult } from '@/types';
import { logger } from '@utils/logger';

const TAG = 'EncryptionCtx';

interface EncryptionContextType {
  /** Whether encryption has been set up (salt exists) */
  isSetup: boolean;
  /** Whether the user is currently authenticated (master key in memory) */
  isAuthenticated: boolean;
  /** Whether a setup/verify operation is in progress */
  isLoading: boolean;
  /** Last error message */
  error: string | null;
  /** Set up encryption with a new password */
  setup: (password: string) => Promise<void>;
  /** Authenticate with existing password */
  authenticate: (password: string) => Promise<void>;
  /** Lock the vault (clear master key from memory) */
  lock: () => void;
  /** Encrypt file data using the current master key */
  encrypt: (data: Uint8Array) => EncryptionResult;
  /** Decrypt file data using the current master key */
  decrypt: (encryptedData: string, encryptedKey: string, iv: string) => Uint8Array;
  /** Reset encryption (WARNING: makes existing files unrecoverable) */
  reset: () => Promise<void>;
  /** Clear error state */
  clearError: () => void;
}

const EncryptionContext = createContext<EncryptionContextType>({
  isSetup: false,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  setup: async () => {},
  authenticate: async () => {},
  lock: () => {},
  encrypt: () => ({ encryptedData: '', encryptedKey: '', iv: '' }),
  decrypt: () => new Uint8Array(0),
  reset: async () => {},
  clearError: () => {},
});

export function EncryptionProvider({ children }: { children: ReactNode }) {
  const [isSetup, setIsSetup] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Master key is kept ONLY in memory, never persisted to disk
  const [masterKey, setMasterKey] = useState<Uint8Array | null>(null);

  // Check if encryption is set up on mount
  React.useEffect(() => {
    (async () => {
      try {
        const setup = await isEncryptionSetup();
        setIsSetup(setup);
        logger.info(TAG, `Encryption ${setup ? 'already set up' : 'not set up'}`);
      } catch (err) {
        logger.error(TAG, 'Failed to check encryption setup:', err);
      }
    })();
  }, []);

  const setupEncryptionPassword = useCallback(async (password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await setupEncryption(password);
      setMasterKey(result.masterKey);
      setIsSetup(true);
      setIsAuthenticated(true);
      logger.info(TAG, 'Encryption setup successful');
    } catch (err: any) {
      const message = err?.message || 'Failed to set up encryption';
      setError(message);
      logger.error(TAG, message, err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const authenticateWithPassword = useCallback(async (password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const key = await verifyPassword(password);
      setMasterKey(key);
      setIsAuthenticated(true);
      logger.info(TAG, 'Authentication successful');
    } catch (err: any) {
      const message = err?.message || 'Authentication failed';
      setError(message);
      logger.error(TAG, message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const lock = useCallback(() => {
    // Zero out the master key before clearing
    if (masterKey) {
      masterKey.fill(0);
    }
    setMasterKey(null);
    setIsAuthenticated(false);
    logger.info(TAG, 'Vault locked. Master key cleared from memory.');
  }, [masterKey]);

  const encrypt = useCallback(
    (data: Uint8Array): EncryptionResult => {
      if (!masterKey) {
        throw new Error('Vault is locked. Please authenticate first.');
      }
      return encryptFile(data, masterKey);
    },
    [masterKey],
  );

  const decrypt = useCallback(
    (encryptedData: string, encryptedKey: string, iv: string): Uint8Array => {
      if (!masterKey) {
        throw new Error('Vault is locked. Please authenticate first.');
      }
      return decryptFile(encryptedData, encryptedKey, iv, masterKey);
    },
    [masterKey],
  );

  const resetEncryptionAll = useCallback(async () => {
    lock();
    await resetEncryption();
    setIsSetup(false);
    logger.warn(TAG, 'Encryption reset. Vault is now empty.');
  }, [lock]);

  const clearError = useCallback(() => setError(null), []);

  return (
    <EncryptionContext.Provider
      value={{
        isSetup,
        isAuthenticated,
        isLoading,
        error,
        setup: setupEncryptionPassword,
        authenticate: authenticateWithPassword,
        lock,
        encrypt,
        decrypt,
        reset: resetEncryptionAll,
        clearError,
      }}
    >
      {children}
    </EncryptionContext.Provider>
  );
}

export function useEncryption() {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error('useEncryption must be used within an EncryptionProvider');
  }
  return context;
}
