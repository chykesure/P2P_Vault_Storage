/**
 * IPFS Client Service
 *
 * Handles all IPFS operations for the P2P Storage Vault.
 * Uses HTTP API to communicate with IPFS gateways (no local daemon).
 *
 * Upload Strategy: Use Pinata's pinJSONToIPFS with a self-describing wrapper.
 *   pinJSONToIPFS expects an object for pinataContent, so we wrap base64 data
 *   as { _d: "base64..." }. On download we detect and unwrap this format.
 *
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
 * @param data - File data as Uint8Array or base64 string
 * @param fileName - Name of the file (for Pinata metadata)
 * @param mimeType - MIME type of the file
 * @returns IPFSUploadResult with CID and upload metadata
 */
export async function uploadToIPFS(
  data: Uint8Array | string,
  fileName: string,
  mimeType: string,
): Promise<IPFSUploadResult> {
  const isBase64 = typeof data === 'string';
  const sizeLabel = isBase64 ? `${(data as string).length} chars (base64)` : `${(data as Uint8Array).length} bytes`;
  logger.info(TAG, `Uploading to IPFS: ${fileName} (${sizeLabel})`);
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

  // Fallback: convert to Uint8Array if needed, then try public gateways
  const bytes = isBase64 ? base64ToUint8Array(data as string) : (data as Uint8Array);
  try {
    const result = await uploadViaPublicGateway(bytes, fileName, mimeType);
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
 * Upload via Pinata's pinJSONToIPFS endpoint.
 *
 * IMPORTANT: pinJSONToIPFS expects pinataContent to be a JSON object.
 * We wrap the base64 data as { _d: "base64..." } so that:
 *   1. Pinata accepts it (it's a valid object)
 *   2. On download we can detect and unwrap it to get raw bytes
 */
async function uploadViaPinata(
  data: Uint8Array | string,
  fileName: string,
  mimeType: string,
): Promise<IPFSUploadResult> {
  const url = `${PINATA_CONFIG.baseUrl}${PINATA_CONFIG.pinJSONEndpoint}`;
  const startTime = Date.now();

  // Convert to base64 string
  const base64Data = typeof data === 'string' ? data : uint8ArrayToBase64(data);
  const dataSize = typeof data === 'string' ? data.length : (data as Uint8Array).length;

  // CRITICAL: Wrap in an object so Pinata stores proper JSON.
  // Without this wrapper, Pinata stores a raw JSON string which breaks downloads.
  const body = JSON.stringify({
    pinataContent: {
      _v: 1,            // wrapper version
      _d: base64Data,    // the actual base64-encoded data
    },
    pinataMetadata: {
      name: `${fileName}`,
      keyvalues: {
        app: 'P2PStorageVault',
        type: mimeType,
        version: ENCRYPTION_VERSION,
        uploadedAt: new Date().toISOString(),
      },
    },
    pinataOptions: {
      cidVersion: 1,
    },
  });

  logger.info(TAG, `Sending to Pinata: ${Math.round(body.length / 1024)}KB JSON payload`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IPFS_UPLOAD_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PINATA_CONFIG.jwt}`,
        'Content-Type': 'application/json',
      },
      body,
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
      size: result.PinSize || dataSize,
      gatewayUsed: 'Pinata',
      uploadTime: Date.now() - startTime,
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
 * Handles the pinJSONToIPFS wrapper format ({ _v: 1, _d: "base64..." })
 * transparently — if the downloaded content is our wrapper, it unwraps
 * the base64 data and returns the raw bytes.
 *
 * @param cid - The IPFS Content Identifier
 * @returns The file data as ArrayBuffer (raw bytes, unwrapped)
 */
export async function downloadFromIPFS(cid: string): Promise<ArrayBuffer> {
  logger.info(TAG, `Downloading CID: ${cid}`);
  const startTime = Date.now();

  const { data, gatewayUrl } = await fetchWithFallback(cid);

  // Try to unwrap the pinJSONToIPFS wrapper format: { _v: 1, _d: "base64..." }
  try {
    const bytes = new Uint8Array(data);
    const text = new TextDecoder('utf-8').decode(bytes);

    // Quick check: only try JSON parse if it starts with '{'
    if (text.trimStart().startsWith('{')) {
      const parsed = JSON.parse(text);

      if (parsed && typeof parsed._d === 'string') {
        // This is our wrapper format — decode the base64 data
        logger.info(TAG, `Unwrapping pinJSONToIPFS format (from ${gatewayUrl})`);
        const rawBytes = base64ToUint8Array(parsed._d);
        const duration = Date.now() - startTime;
        logger.info(TAG, `Unwrapped ${rawBytes.length} bytes in ${duration}ms`);
        return rawBytes.buffer;
      }
    }
    // Not our wrapper format — return raw bytes as-is
  } catch {
    // Not valid JSON — return raw bytes as-is (e.g., binary data from public gateways)
  }

  const duration = Date.now() - startTime;
  logger.info(TAG, `Downloaded ${data.byteLength} raw bytes in ${duration}ms`);

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
    const url = `${PINATA_CONFIG.baseUrl}/pinning/pinByHash`;

    const body = JSON.stringify({
      hashToPin: cid,
      pinataMetadata: {
        name: `vault-pin-${cid.slice(0, 12)}`,
        keyvalues: {
          app: 'P2PStorageVault',
          pinnedAt: new Date().toISOString(),
        },
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
      if (response.status === 400 && errorText.includes('already')) {
        logger.info(TAG, `CID ${cid} is already pinned on Pinata.`);
        return { success: true, cid, service: 'Pinata' };
      }
      throw new Error(`Pinata pinByHash error (${response.status}): ${errorText}`);
    }

    return {
      success: true,
      cid,
      service: 'Pinata',
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
  // Chunk-based encoding to avoid memory issues with large files
  const chunkSize = 8192;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    let binary = '';
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
    chunks.push(btoa(binary));
  }
  return chunks.join('');
}

function base64ToUint8Array(base64: string): Uint8Array {
  // React Native polyfill for atob (not available in all RN versions)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  const cleaned = base64.replace(/=+$/, '');
  const len = cleaned.length;
  const bufLen = Math.floor(len * 3 / 4);
  const bytes = new Uint8Array(bufLen);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const encoded = cleaned.slice(i, i + 4);
    const a = lookup[encoded.charCodeAt(0)] || 0;
    const b = lookup[encoded.charCodeAt(1)] || 0;
    const c = lookup[encoded.charCodeAt(2)] || 0;
    const d = lookup[encoded.charCodeAt(3)] || 0;

    bytes[p++] = (a << 2) | (b >> 4);
    if (p < bufLen) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < bufLen) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes;
}