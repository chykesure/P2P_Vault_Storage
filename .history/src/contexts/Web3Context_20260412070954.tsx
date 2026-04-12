/**
 * Web3 Context — WalletConnect + MetaMask mobile support
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAccount, useDisconnect, useChainId } from 'wagmi';
import { Web3Modal } from '@web3modal/wagmi-react-native';
import Constants from 'expo-constants';

import { WalletState } from '@/types';
import { WALLETCONNECT_PROJECT_ID, createWagmiConfig, getCurrentNetwork, CHAIN_DISPLAY_NAMES, CHAIN_CONFIG } from '@config/network';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
  openModal: () => void;
  disconnect: () => void;
  chainId: number;
  projectId: string;
  networkName: string;
  isProjectIdConfigured: boolean;
  chainConfig: { chainId: number; explorerUrl: string; blockExplorerTxUrl: string } | null;
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
  isProjectIdConfigured: false,
  chainConfig: null,
});

export function Web3Provider({ children }: { children: ReactNode }) {
  const { address, isConnected, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const [error, setError] = useState<string | null>(null);

  const network = getCurrentNetwork();

  const openModal = () => {
    if (!projectId || projectId === 'YOUR_PROJECT_ID') {
      setError(
        'WalletConnect Project ID not configured.\n\n' +
        'Get a FREE Project ID from:\nhttps://cloud.walletconnect.com\n\n' +
        'Then set it in app.json under "extra.walletConnectProjectId"'
      );
      return;
    }
    setError(null);
    Web3Modal.open();
  };

  return (
    <Web3Context.Provider
      value={{
        isConnected,
        address,
        chainId,
        isConnecting,
        error,
        openModal,
        disconnect: () => disconnect(),
        projectId,
        networkName: CHAIN_DISPLAY_NAMES[network],
        isProjectIdConfigured: projectId !== 'YOUR_PROJECT_ID' && projectId.length > 10,
        chainConfig: CHAIN_CONFIG[network],
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

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