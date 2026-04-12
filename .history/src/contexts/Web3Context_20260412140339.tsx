/**
 * Web3 Context
 *
 * Wraps wagmi's WalletConnect functionality in a React context
 * for easy access throughout the app.
 *
 * Uses @web3modal/wagmi-react-native to handle MetaMask deep linking.
 */

// MUST be first import — enables WalletConnect polyfills for React Native
import '@walletconnect/react-native-compat';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useAccount, useDisconnect, useChainId } from 'wagmi';
import { Web3Modal } from '@web3modal/wagmi-react-native';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';

import { WalletState } from '@/types';
import { WALLETCONNECT_PROJECT_ID, createWagmiConfig, getCurrentNetwork, CHAIN_DISPLAY_NAMES } from '@config/network';

// Use expo-constants as fallback for project ID if env var not set
const projectId =
  WALLETCONNECT_PROJECT_ID !== 'YOUR_PROJECT_ID'
    ? WALLETCONNECT_PROJECT_ID
    : Constants.expoConfig?.extra?.walletConnectProjectId || 'YOUR_PROJECT_ID';

const wagmiConfig = createWagmiConfig();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

interface Web3ContextType extends WalletState {
  /** Open the WalletConnect modal */
  openModal: () => void;
  /** Disconnect the current wallet */
  disconnect: () => void;
  /** Current chain ID */
  chainId: number;
  /** WalletConnect project ID being used */
  projectId: string;
  /** Current network display name */
  networkName: string;
}

const Web3Context = createContext<Web3ContextType>({
  isConnected: false,
  address: null,
  chainId: 0,
  isConnecting: false,
  error: null,
  openModal: () => {},
  disconnect: () => {},
  projectId: '',
  networkName: '',
});

export function Web3Provider({ children }: { children: ReactNode }) {
  const { address, isConnected, isConnecting } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const wagmiChainId = useChainId();

  // Convert wagmi types (undefined) to WalletState types (null)
  const walletAddress: string | null = address ?? null;
  const walletChainId: number = wagmiChainId ?? 0;
  const [error, setError] = useState<string | null>(null);
  const network = getCurrentNetwork();

  const openModal = useCallback(() => {
    setError(null);
    if (projectId === 'YOUR_PROJECT_ID') {
      setError('WalletConnect Project ID not configured. Get one from cloud.walletconnect.com');
      return;
    }
    Web3Modal.open();
  }, []);

  const handleDisconnect = useCallback(() => {
    wagmiDisconnect();
    setError(null);
  }, [wagmiDisconnect]);

  return (
    <Web3Context.Provider
      value={{
        isConnected,
        address: walletAddress,
        chainId: walletChainId,
        isConnecting,
        error,
        openModal,
        disconnect: handleDisconnect,
        projectId,
        networkName: CHAIN_DISPLAY_NAMES[network],
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

/** Top-level provider that wraps wagmi + Web3Modal + QueryClient */
export function Web3Wrapper({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Web3Modal projectId={projectId} />
        <Web3Provider>
          {children}
        </Web3Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
}