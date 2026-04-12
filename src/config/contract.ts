/**
 * Smart contract configuration and addresses.
 * Update these values after deploying the FileVault contract.
 *
 * Values are loaded from:
 * 1. EXPO_PUBLIC_* environment variables (highest priority)
 * 2. app.json → extra field (Expo convention)
 */

import Constants from 'expo-constants';

import { FILE_VAULT_ABI } from '@contracts/FileVaultABI';

/** Get config value from env or expo-constants fallback */
function getConfigValue(envKey: string, extraKey: string, defaultValue: string): string {
  return (process.env[envKey] as string) ||
    (Constants.expoConfig?.extra?.[extraKey] as string) ||
    defaultValue;
}

/** Get current network */
function getNetwork(): string {
  return getConfigValue('EXPO_PUBLIC_NETWORK', 'network', 'polygonAmoy');
}

/** Contract addresses per network */
export const CONTRACT_ADDRESSES: Record<string, `0x${string}`> = {
  sepolia: (getConfigValue(
    'EXPO_PUBLIC_CONTRACT_ADDRESS',
    'contractAddress',
    '0x0000000000000000000000000000000000000000',
  )) as `0x${string}`,
  polygon: '0x0000000000000000000000000000000000000000',
  polygonAmoy: (getConfigValue(
    'EXPO_PUBLIC_CONTRACT_ADDRESS',
    'contractAddress',
    '0x0000000000000000000000000000000000000000',
  )) as `0x${string}`,
  mainnet: '0x0000000000000000000000000000000000000000',
};

/** Get the contract address for the current network */
export function getContractAddress(): `0x${string}` {
  const network = getNetwork();
  const address = CONTRACT_ADDRESSES[network] || CONTRACT_ADDRESSES['polygonAmoy'];
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    console.warn(
      '[Contract] Using placeholder contract address. ' +
      'Deploy the FileVault contract and update CONTRACT_ADDRESSES.'
    );
  }
  return address;
}

/** Contract configuration object for easy import */
export const FILE_VAULT_CONFIG = {
  address: getContractAddress(),
  abi: FILE_VAULT_ABI,
} as const;

/** Estimated gas limits for contract operations */
export const GAS_ESTIMATES = {
  addFile: 150_000n,
  removeFile: 80_000n,
} as const;