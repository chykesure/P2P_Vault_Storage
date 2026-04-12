/**
 * IPFS gateway configuration.
 * Supports multiple fallback gateways for resilience.
 * Config values loaded from EXPO_PUBLIC_* env vars or app.json → extra.
 */

import Constants from 'expo-constants';

export interface GatewayDefinition {
  name: string;
  uploadUrl: string;
  downloadUrl: string;
  healthCheckUrl: string;
}

/**
 * Default gateway list with fallback support.
 * The app will try each gateway in order until one succeeds.
 */
export const IPFS_GATEWAYS: GatewayDefinition[] = [
  {
    name: 'Pinata Gateway',
    uploadUrl: 'https://api.pinata.cloud/pinning/pinFileToIPFS',
    downloadUrl: 'https://gateway.pinata.cloud/ipfs/',
    healthCheckUrl: 'https://api.pinata.cloud/data/testAuthentication',
  },
  {
    name: 'IPFS.io',
    uploadUrl: 'https://ipfs.io/api/v0/add',
    downloadUrl: 'https://ipfs.io/ipfs/',
    healthCheckUrl: 'https://ipfs.io/api/v0/version',
  },
  {
    name: 'Cloudflare IPFS',
    uploadUrl: 'https://cloudflare-ipfs.com/api/v0/add',
    downloadUrl: 'https://cloudflare-ipfs.com/ipfs/',
    healthCheckUrl: 'https://cloudflare-ipfs.com/api/v0/version',
  },
  {
    name: 'dWeb.link',
    uploadUrl: 'https://dweb.link/api/v0/add',
    downloadUrl: 'https://dweb.link/ipfs/',
    healthCheckUrl: 'https://dweb.link/api/v0/version',
  },
];

/** Get a download URL for a given CID using a specific gateway */
export function getDownloadUrl(cid: string, gatewayIndex = 0): string {
  const gateway = IPFS_GATEWAYS[gatewayIndex] || IPFS_GATEWAYS[0];
  return `${gateway.downloadUrl}${cid}`;
}

/** Get a download URL with raw binary output (for file fetching) */
export function getRawDownloadUrl(cid: string, gatewayIndex = 0): string {
  const gateway = IPFS_GATEWAYS[gatewayIndex] || IPFS_GATEWAYS[0];
  return `${gateway.downloadUrl}${cid}?format=raw`;
}

/** Helper to get env or expo-constants value */
function envOrExtra(envKey: string, extraKey: string): string {
  return (process.env[envKey] as string) ||
    (Constants.expoConfig?.extra?.[extraKey] as string) ||
    '';
}

/** Pinning service configuration (Pinata) */
export const PINATA_CONFIG = {
  apiKey: envOrExtra('EXPO_PUBLIC_PINATA_API_KEY', 'pinataApiKey'),
  secretKey: envOrExtra('EXPO_PUBLIC_PINATA_SECRET_KEY', 'pinataSecretKey'),
  jwt: envOrExtra('EXPO_PUBLIC_PINATA_JWT', 'pinataJwt'),
  baseUrl: 'https://api.pinata.cloud',
  pinListEndpoint: '/data/pinList',
  pinFileEndpoint: '/pinning/pinFileToIPFS',
  pinJSONEndpoint: '/pinning/pinJSONToIPFS',
  unpinEndpoint: '/pinning/unpin',
} as const;
