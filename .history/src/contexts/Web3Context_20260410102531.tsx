/**
 * Web3 Context
 *
 * Wraps wagmi's WalletConnect functionality in a React context
 * for easy access throughout the app.
 *
 * NOTE: @web3modal/wagmi-react-native is incompatible with wagmi v2 + SDK 54.
 * This file uses wagmi directly with a simple native modal for wallet connection.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useAccount, useDisconnect, useChainId, useConnect } from 'wagmi';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import Constants from 'expo-constants';

import { WalletState } from '@/types';
import { WALLETCONNECT_PROJECT_ID, createWagmiConfig } from '@config/network';

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
  /** Open the wallet connection modal */
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
  openModal: () => { },
  disconnect: () => { },
  projectId: '',
});

export function Web3Provider({ children }: { children: ReactNode }) {
  const { address, isConnected, isConnecting } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const chainId = useChainId();
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const openModal = useCallback(() => {
    setError(null);
    setModalVisible(true);
  }, []);

  const handleConnect = useCallback((connectorId: number) => {
    try {
      const connector = connectors[connectorId];
      if (connector) {
        connect({ connector });
      }
      setModalVisible(false);
    } catch (err: any) {
      setError(err.message || 'Connection failed');
    }
  }, [connect, connectors]);

  const handleDisconnect = useCallback(() => {
    wagmiDisconnect();
    setModalVisible(false);
    setError(null);
  }, [wagmiDisconnect]);

  return (
    <>
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
        }}
      >
        {children}
      </Web3Context.Provider>

      {/* Wallet Connection Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.container}>
            <Text style={modalStyles.title}>Connect Wallet</Text>

            {isConnecting && (
              <View style={modalStyles.loadingContainer}>
                <ActivityIndicator size="large" color="#6C5CE7" />
                <Text style={modalStyles.loadingText}>Connecting...</Text>
              </View>
            )}

            {!isConnecting && (
              <ScrollView style={modalStyles.connectorList}>
                {connectors.map((connector, index) => (
                  <TouchableOpacity
                    key={connector.uid}
                    style={modalStyles.connectorButton}
                    onPress={() => handleConnect(index)}
                  >
                    <Text style={modalStyles.connectorName}>
                      {connector.name}
                    </Text>
                    <Text style={modalStyles.connectorId}>
                      {connector.id}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {error && (
              <View style={modalStyles.errorContainer}>
                <Text style={modalStyles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={modalStyles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={modalStyles.closeButtonText}>Close</Text>
            </TouchableOpacity>

            {isConnected && (
              <TouchableOpacity
                style={modalStyles.disconnectButton}
                onPress={handleDisconnect}
              >
                <Text style={modalStyles.disconnectButtonText}>Disconnect</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
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

// Modal styles
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  connectorList: {
    maxHeight: 300,
  },
  connectorButton: {
    backgroundColor: '#F7F8FC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E8E8F0',
  },
  connectorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  connectorId: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  errorContainer: {
    backgroundColor: '#FFE8E8',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  errorText: {
    color: '#D63031',
    fontSize: 14,
    textAlign: 'center',
  },
  closeButton: {
    marginTop: 12,
    backgroundColor: '#E8E8F0',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  disconnectButton: {
    marginTop: 8,
    backgroundColor: '#FFE8E8',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  disconnectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D63031',
  },
});