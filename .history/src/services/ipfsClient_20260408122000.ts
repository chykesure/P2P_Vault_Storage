/**
 * IPFS Client Service
 *
 * Handles all IPFS operations for the P2P Storage Vault.
 * Uses HTTP API to communicate with IPFS gateways (no local daemon).
 *
 * Upload Strategy: Use Pinata's dedicated API for reliable uploads.
 * Download Strategy: Try multiple public gateways with automatic fallback.
 */

import { IPFSUploadResult, PinResult } from '@/types';
import { IPFS_GATEWAYS, PINATA_CONFIG } from '@config/ipfs';
import { IPFS_UPLOAD_TIMEOUT, IPFS_DOWNLOAD_TIMEOUT, ENCRYPTION_VERSION } from '@config/constants';
import { fetchWithFallback } from '@utils/gatewayFallback';
import { logger } from '@utils/logger';

const TAG = 'IPFS';

// ========================================
// Upload Operations
// ========================================

/**
 * Upload data to IPFS via Pinata API.
 * This is the primary upload method - Pinata provides reliable pinning.
 *
 * @param data - File data as Uint8Array
 * @param fileName - Name of the file (for Pinata metadata)
 * @param mimeType - MIME type of the file
 * @returns IPFSUploadResult with CID and upload metadata
 */
export async function uploadToIPFS(
  data: Uint8Array,
  fileName: string,
  mimeType: string,
): Promise<IPFSUploadResult> {
  logger.info(TAG, `Uploading to IPFS: ${fileName} (${data.length} bytes)`);
  const startTime = Date.now();

  // Try Pinata first if credentials are configured
  if (PINATA_CONFIG.jwt) {
    try {
      const result = await uploadViaPinata(data, fileName, mimeType);
      const duration = Date.now() - startTime;
      logger.info(TAG, `Uploaded to Pinata in ${duration}ms. CID: ${result.cid}`);
      return result;
    } catch (error) {
      logger.warn(TAG, 'Pinata upload failed, trying fallback gateway...', error);
    }
  }

  // Fallback: try public gateway upload APIs
  try {
    const result = await uploadViaPublicGateway(data, fileName, mimeType);
    const duration = Date.now() - startTime;
    logger.info(TAG, `Uploaded via fallback gateway in ${duration}ms. CID: ${result.cid}`);
    return result;
  } catch (error) {
    logger.error(TAG, 'All upload methods failed.', error);
    throw new Error(
      'Failed to upload to IPFS. Please check your internet connection and Pinata credentials.',
    );
  }
}

/**
 * Upload via Pinata's pinning API using JWT authentication.
 */
async function uploadViaPinata(
  data: Uint8Array,
  fileName: string,
  mimeType: string,
): Promise<IPFSUploadResult> {
  const url = `${PINATA_CONFIG.baseUrl}${PINATA_CONFIG.pinFileEndpoint}`;

  // Convert Uint8Array to Blob for multipart upload
  const blob = new Blob([data], { type: mimeType });
  const formData = new FormData();
  formData.append('file', {
    uri: `data:${mimeType};base64,${uint8ArrayToBase64(data)}`,
    name: fileName,
    type: mimeType,
  } as any);

  // Add metadata
  const metadata = JSON.stringify({
    name: fileName,
    keyvalues: {
      app: 'P2PStorageVault',
      type: mimeType,
      version: ENCRYPTION_VERSION,
      uploadedAt: new Date().toISOString(),
    },
  });
  formData.append('pinataMetadata', metadata);

  // Add options
  const options = JSON.stringify({
    cidVersion: 1,
  });
  formData.append('pinataOptions', options);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IPFS_UPLOAD_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PINATA_CONFIG.jwt}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    return {
      cid: result.IpfsHash || result.cid,
      size: result.PinSize || data.length,
      gatewayUsed: 'Pinata',
      uploadTime: Date.now() - (Date.now() - startTime),
    };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * Upload via a public IPFS gateway's HTTP API.
 */
async function uploadViaPublicGateway(
  data: Uint8Array,
  fileName: string,
  mimeType: string,
): Promise<IPFSUploadResult> {
  // Try each gateway that supports uploads
  const uploadGateways = IPFS_GATEWAYS.filter(g => g.uploadUrl.includes('/api/'));

  for (const gateway of uploadGateways) {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: `data:${mimeType};base64,${uint8ArrayToBase64(data)}`,
        name: fileName,
        type: mimeType,
      } as any);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), IPFS_UPLOAD_TIMEOUT);
      const startTime = Date.now();

      const response = await fetch(gateway.uploadUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) continue;

      const result = await response.json();
      const cid = result.Hash || result.cid;

      if (cid) {
        return {
          cid,
          size: data.length,
          gatewayUsed: gateway.name,
          uploadTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      logger.warn(TAG, `Upload to ${gateway.name} failed:`, error);
      continue;
    }
  }

  throw new Error('No public gateway accepted the upload.');
}

// ========================================
// Download Operations
// ========================================

/**
 * Download a file from IPFS using automatic gateway fallback.
 *
 * @param cid - The IPFS Content Identifier
 * @returns The file data as ArrayBuffer
 */
export async function downloadFromIPFS(cid: string): Promise<ArrayBuffer> {
  logger.info(TAG, `Downloading CID: ${cid}`);
  const startTime = Date.now();

  const { data } = await fetchWithFallback(cid);

  const duration = Date.now() - startTime;
  logger.info(TAG, `Downloaded ${data.byteLength} bytes in ${duration}ms`);

  return data;
}

/**
 * Download a file from IPFS and convert to Uint8Array.
 *
 * @param cid - The IPFS Content Identifier
 * @returns The file data as Uint8Array
 */
export async function downloadAsUint8Array(cid: string): Promise<Uint8Array> {
  const arrayBuffer = await downloadFromIPFS(cid);
  return new Uint8Array(arrayBuffer);
}

/**
 * Get a direct download URL for a CID (for sharing or linking).
 *
 * @param cid - The IPFS Content Identifier
 * @param gatewayIndex - Optional gateway index to prefer
 * @returns A URL string that can be used to access the file
 */
export function getIPFSUrl(cid: string, gatewayIndex?: number): string {
  if (gatewayIndex !== undefined) {
    return `${IPFS_GATEWAYS[gatewayIndex].downloadUrl}${cid}`;
  }
  return `${IPFS_GATEWAYS[0].downloadUrl}${cid}`;
}

// ========================================
// Pinning Operations
// ========================================

/**
 * Pin a CID to ensure it persists on the IPFS network.
 * Uses Pinata's pinning service.
 *
 * @param cid - The CID to pin
 * @returns PinResult with status
 */
export async function pinToIPFS(cid: string): Promise<PinResult> {
  if (!PINATA_CONFIG.jwt) {
    logger.warn(TAG, 'No Pinata JWT configured. Skipping pinning.');
    return {
      success: false,
      cid,
      service: 'none',
    };
  }

  logger.info(TAG, `Pinning CID: ${cid}`);

  try {
    const url = `${PINATA_CONFIG.baseUrl}${PINATA_CONFIG.pinJSONEndpoint}`;

    const body = JSON.stringify({
      pinataContent: { cid },
      pinataMetadata: {
        name: `vault-pin-${cid.slice(0, 12)}`,
        keyvalues: {
          app: 'P2PStorageVault',
          pinnedAt: new Date().toISOString(),
        },
      },
      pinataOptions: {
        cidVersion: 1,
      },
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PINATA_CONFIG.jwt}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata pin API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    return {
      success: true,
      cid,
      service: 'Pinata',
      pinExpiresAt: undefined, // Pinata pins persist until manually removed
    };
  } catch (error) {
    logger.error(TAG, `Failed to pin CID ${cid}:`, error);
    return {
      success: false,
      cid,
      service: 'Pinata',
    };
  }
}

/**
 * Check if a CID is pinned on Pinata.
 */
export async function checkPinStatus(cid: string): Promise<boolean> {
  if (!PINATA_CONFIG.jwt) return false;

  try {
    const url = `${PINATA_CONFIG.baseUrl}${PINATA_CONFIG.pinListEndpoint}?status=pinned&cidContains=${cid}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PINATA_CONFIG.jwt}`,
      },
    });

    if (!response.ok) return false;

    const result = await response.json();
    return result.rows && result.rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Unpin a CID from Pinata.
 */
export async function unpinFromIPFS(cid: string): Promise<boolean> {
  if (!PINATA_CONFIG.jwt) return false;

  try {
    const url = `${PINATA_CONFIG.baseUrl}${PINATA_CONFIG.unpinEndpoint}/${cid}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${PINATA_CONFIG.jwt}`,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

// ========================================
// Utility Functions
// ========================================

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
