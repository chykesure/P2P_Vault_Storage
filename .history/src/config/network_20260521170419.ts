import { createConfig, http } from 'wagmi';
import { sepolia, polygon, polygonAmoy, mainnet } from 'wagmi/chains';
import Constants from 'expo-constants';

export const WALLETCONNECT_PROJECT_ID =
  (process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID as string) ||
  (Constants.expoConfig?.extra?.walletConnectProjectId as string) ||
  'YOUR_PROJECT_ID';

export const SUPPORTED_CHAINS = {
  sepolia,
  polygon,
  polygonAmoy,
  mainnet,
} as const;

export type SupportedChainName = keyof typeof SUPPORTED_CHAINS;

export const CHAIN_DISPLAY_NAMES: Record<SupportedChainName, string> = {
  sepolia: 'Sepolia Testnet',
  polygon: 'Polygon Mainnet',
  polygonAmoy: 'Polygon Amoy Testnet',
  mainnet: 'Ethereum Mainnet',
};

export const CHAIN_CONFIG: Record<
  SupportedChainName,
  {
    chainId: number;
    rpcUrl: string;
    explorerUrl: string;
    blockExplorerTxUrl: string;
  }
> = {
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

export function getCurrentNetwork(): SupportedChainName {
  return (
    (process.env.EXPO_PUBLIC_NETWORK as SupportedChainName) ||
    (Constants.expoConfig?.extra?.network as SupportedChainName) ||
    'polygonAmoy'
  );
}

export function getCurrentChainConfig() {
  const network = getCurrentNetwork();
  return CHAIN_CONFIG[network];
}

export function createWagmiConfig() {
  const network = getCurrentNetwork();

  return createConfig({
    chains: [SUPPORTED_CHAINS[network]],

    transports: {
      [sepolia.id]: http(),
      [polygon.id]: http(),
      [polygonAmoy.id]: http(),
      [mainnet.id]: http(),
    },
  });
}