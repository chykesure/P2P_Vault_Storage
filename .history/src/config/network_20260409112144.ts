/**
 * Network configuration for different blockchain environments.
 * Supports Sepolia testnet, Polygon Amoy, Polygon, and Ethereum mainnet.
 */

import { createConfig, http } from 'wagmi';
import { sepolia, polygon, polygonAmoy, mainnet } from 'wagmi/chains';
import { walletConnect } from 'wagmi/connectors';
import Constants from 'expo-constants';

// WalletConnect Project ID — loaded from env or app.json → extra
export const WALLETCONNECT_PROJECT_ID =
  (process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID as string) ||
  (Constants.expoConfig?.extra?.walletConnectProjectId as string) ||
  'YOUR_PROJECT_ID';

export const SUPPORTED_CHAINS = {
  sepolia: sepolia,
  polygon: polygon,
  polygonAmoy: polygonAmoy,
  mainnet: mainnet,
} as const;

export type SupportedChainName = keyof typeof SUPPORTED_CHAINS;

export const CHAIN_CONFIG: Record<SupportedChainName, { chainId: number; rpcUrl: string; explorerUrl: string; blockExplorerTxUrl: string }> = {
  sepolia: {
    chainId: sepolia.id,
    rpcUrl: 'https://rpc.sepolia.org',
    explorerUrl: 'https://sepolia.etherscan.io',
    blockExplorerTxUrl: 'https://sepolia.etherscan.io/tx/',
  },
  polygon: {
    chainId: polygon.id,
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    blockExplorerTxUrl: 'https://polygonscan.com/tx/',
  },
  polygonAmoy: {
    chainId: polygonAmoy.id,
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    explorerUrl: 'https://amoy.polygonscan.com',
    blockExplorerTxUrl: 'https://amoy.polygonscan.com/tx/',
  },
  mainnet: {
    chainId: mainnet.id,
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    blockExplorerTxUrl: 'https://etherscan.io/tx/',
  },
};

/** Get the current network from env, app.json, or default to polygonAmoy */
export function getCurrentNetwork(): SupportedChainName {
  return ((process.env.EXPO_PUBLIC_NETWORK as SupportedChainName) ||
    (Constants.expoConfig?.extra?.network as SupportedChainName) ||
    'polygonAmoy');
}

/** Get the current chain configuration */
export function getCurrentChainConfig() {
  const network = getCurrentNetwork();
  return CHAIN_CONFIG[network];
}

/** Create the wagmi configuration for Web3Modal */
export function createWagmiConfig() {
  const network = getCurrentNetwork();

  const metadata = {
    name: 'P2P Storage Vault',
    description: 'Decentralized encrypted file storage on IPFS',
    url: 'https://p2pstoragevault.app',
    icons: ['https://p2pstoragevault.app/icon.png'],
    redirect: {
      native: 'p2pstoragevault://',
      universal: 'https://p2pstoragevault.app',
    },
  };

  return createConfig({
    chains: [SUPPORTED_CHAINS[network]],
    transports: {
      [sepolia.id]: http(),
      [polygon.id]: http(),
      [polygonAmoy.id]: http(),
      [mainnet.id]: http(),
    },
    connectors: [
      walletConnect({
        projectId: WALLETCONNECT_PROJECT_ID,
        metadata,
        showQrModal: false,
      }),
    ],
  });
}