/**
 * Web3 Context
 *
 * Wraps wagmi's Web3Modal/WalletConnect functionality
 * in a React context for easy access throughout the app.
 *
 * Expo note: WalletConnect requires a custom development client.
 * Use `npx expo run:ios` or `npx expo run:android` to build
 * a dev client with WalletConnect native support.
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useAccount, useDisconnect, useChainId } from 'wagmi';
import { Web3Modal } from '@web3modal/wagmi-react-native';
import Constants from 'expo-constants';

import { WalletState } from '@/types';
import { WALLETCONNECT_PROJECT_ID, createWagmiConfig } from '@config/network';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Use expo-constants as fallback for project ID if env var not set
const projectId =
  WALLETCONNECT_PROJECT_ID !== 'YOUR_PROJECT_ID'
    ? WALLETCONNECT_PROJECT_ID
    : Constants.expoConfig?.extra?.walletConnectProjectId || 'YOUR_PROJECT_ID';

const wagmiConfig = createWagmiConfig();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
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
});

export function Web3Provider({ children }: { children: ReactNode }) {
  const { address, isConnected, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const [error, setError] = useState<string | null>(null);

  return (
    <Web3Context.Provider
      value={{
        isConnected,
        address,
        chainId,
        isConnecting,
        error,
        openModal: () => Web3Modal.open(),
        disconnect: () => disconnect(),
        projectId,
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
