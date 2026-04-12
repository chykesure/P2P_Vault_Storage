/**
 * Web3 Context
 *
 * Wraps wagmi's WalletConnect functionality
 * in a React context for easy access throughout the app.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createConfig, http } from 'wagmi';
import { useAccount, useDisconnect, useChainId, WagmiProvider } from 'wagmi';
import { walletConnect } from 'wagmi/connectors';
import { polygonAmoy, sepolia, polygon, mainnet } from 'viem/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';

// WalletConnect Project ID
const WALLETCONNECT_PROJECT_ID = '88caf1f4db83db8797f12037fbd9f9e1';

// Create wagmi config
const wagmiConfig = createConfig({
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

interface Web3ContextType {
  isConnected: boolean;
  address: string | null;
  chainId: number;
  isConnecting: boolean;
  error: string | null;
  openModal: () => void;
  disconnect: () => void;
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
  projectId: WALLETCONNECT_PROJECT_ID,
});

// Simple Connect Wallet Button Modal
function WalletConnectModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <Text style={modalStyles.title}>Connect Wallet</Text>
          <Text style={modalStyles.subtitle}>
            Open MetaMask on your device and scan the QR code, or use WalletConnect.
          </Text>
          <TouchableOpacity
            style={modalStyles.button}
            onPress={onClose}
          >
            <Text style={modalStyles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#1A237E',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#90CAF9',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#42A5F5',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export function Web3Provider({ children }: { children: ReactNode }) {
  const { address, isConnected, isConnecting, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const openModal = () => {
    setModalVisible(true);
  };

  useEffect(() => {
    if (isConnected && modalVisible) {
      setModalVisible(false);
    }
  }, [isConnected]);

  return (
    <Web3Context.Provider
      value={{
        isConnected,
        address: address || null,
        chainId,
        isConnecting,
        error,
        openModal,
        disconnect: () => disconnect(),
        projectId: WALLETCONNECT_PROJECT_ID,
      }}
    >
      {children}
      <WalletConnectModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </Web3Context.Provider>
  );
}

/** Top-level provider that wraps wagmi + QueryClient */
export function Web3Wrapper({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
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