import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createConfig, http, WagmiProvider } from 'wagmi';
import { walletConnect } from 'wagmi/connectors';
import { polygonAmoy, sepolia, polygon, mainnet } from 'viem/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Your WalletConnect Project ID from app.json
const WALLETCONNECT_PROJECT_ID = '88caf1f4db83db8797f12037fbd9f9e1';

// Create wagmi config (same as src/config/network.ts)
export const config = createConfig({
  chains: [polygonAmoy, sepolia, polygon, mainnet],
  transports: {
    [polygonAmoy.id]: http(),
    [sepolia.id]: http(),
    [polygon.id]: http(),
    [mainnet.id]: http(),
  },
  connectors: [
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      showQrModal: true,
    }),
  ],
});

// Create React Query client
const queryClient = new QueryClient();

// Context types
interface Web3ContextType {
  address: string | undefined;
  isConnected: boolean;
  chainId: number | undefined;
}

const Web3Context = createContext<Web3ContextType>({
  address: undefined,
  isConnected: false,
  chainId: undefined,
});

// Hook to use Web3 context
export function useWeb3() {
  return useContext(Web3Context);
}

// Provider component
export function Web3Provider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | undefined>();
  const [chainId, setChainId] = useState<number | undefined>();

  useEffect(() => {
    // Watch for account and chain changes
    const unwatch = config.subscribe((state) => {
      setAddress(state.current?.address);
      setChainId(state.current?.chainId);
    });

    return () => unwatch();
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <Web3Context.Provider value={{ address, isConnected: !!address, chainId }}>
          {children}
        </Web3Context.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}