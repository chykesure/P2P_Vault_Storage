/**
 * IPFS Client Service
 *
 * Handles all IPFS operations for the P2P Storage Vault.
 * Uses HTTP API to communicate with IPFS gateways (no local daemon).
 *
 * Upload Strategy: Use Pinata pinFileToIPFS via FileSystem.uploadAsync.
 *   - Sends raw binary (no JSON overhead)
 *   - Works for any file size
 *   - Proper multipart handling in React Native
 *
 * Download Strategy: Try multiple public gateways with automatic fallback.
 */

import { IPFSUploadResult, PinResult } from '@/types';
import { IPFS_GATEWAYS, PINATA_CONFIG } from '@config/ipfs';
import { IPFS_UPLOAD_TIMEOUT, ENCRYPTION_VERSION } from '@config/constants';
import { fetchWithFallback } from '@utils/gatewayFallback';
import { logger } from '@utils/logger';
import * as FileSystem from 'expo-file-system/legacy';

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
      const result = await uploadViaPinataFile(data, fileName, mimeType);
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
      'Failed to upload to IPFS. Please check your internet connection and try again.',
    );
  }
}

/**
 * Upload via Pinata's pinFileToIPFS endpoint using FileSystem.uploadAsync.
 *
 * This approach:
 * - Writes encrypted data to a temp file
 * - Uses FileSystem.uploadAsync for proper multipart upload
 * - Sends raw binary (no JSON wrapping overhead, ~25% smaller)
 * - Works for ANY file size (no JSON payload limit)
 * - Cleans up temp file after upload
 */
async function uploadViaPinataFile(
  data: Uint8Array | string,
  fileName: string,
  mimeType: string,
): Promise<IPFSUploadResult> {
  const url = `${PINATA_CONFIG.baseUrl}${PINATA_CONFIG.pinFileEndpoint}`;
  const startTime = Date.now();

  // Convert to base64 string for writing to temp file
  const base64Data = typeof data === 'string' ? data : uint8ArrayToBase64(data as Uint8Array);

  // Write encrypted data to a temp file (base64 encoding → raw bytes on disk)
  const tempUri = `${FileSystem.cacheDirectory}vault_upload_${Date.now()}.bin`;
  await FileSystem.writeAsStringAsync(tempUri, base64Data, { encoding: 'base64' });

  try {
    logger.info(TAG, `Uploading to Pinata via pinFileToIPFS...`);

    const uploadResult = await FileSystem.uploadAsync(url, tempUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      headers: {
        Authorization: `Bearer ${PINATA_CONFIG.jwt}`,
      },
      parameters: {
        pinataMetadata: JSON.stringify({
          name: fileName,
          keyvalues: {
            app: 'P2PStorageVault',
            type: mimeType,
            version: String(ENCRYPTION_VERSION),
            uploadedAt: new Date().toISOString(),
          },
        }),
        pinataOptions: JSON.stringify({ cidVersion: 1 }),
      },
    });

    const result = JSON.parse(uploadResult.body);

    if (!result.IpfsHash && !result.cid) {
      throw new Error(`Pinata upload failed: ${JSON.stringify(result)}`);
    }

    return {
      cid: result.IpfsHash || result.cid,
      size: result.PinSize || base64Data.length,
      gatewayUsed: 'Pinata',
      uploadTime: Date.now() - startTime,
    };
  } finally {
    // Clean up temp file
    try {
      await FileSystem.deleteAsync(tempUri, { idempotent: true });
    } catch {}
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
 * Handles both raw binary (new uploads) and JSON-wrapped (legacy) formats.
 */
export async function downloadFromIPFS(cid: string): Promise<ArrayBuffer> {
  logger.info(TAG, `Downloading CID: ${cid}`);
  const startTime = Date.now();

  const { data, gatewayUrl } = await fetchWithFallback(cid);

  // Try to unwrap legacy pinJSONToIPFS format
  // New uploads (pinFileToIPFS) are raw binary — skip unwrap
  try {
    const bytes = new Uint8Array(data);
    const text = new TextDecoder('utf-8').decode(bytes);
    const trimmed = text.trimStart();

    if (trimmed.startsWith('{')) {
      // Wrapped JSON object: { _v: 1, _d: "base64..." }
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed._d === 'string') {
        logger.info(TAG, `Unwrapping wrapped format (from ${gatewayUrl})`);
        const rawBytes = base64ToUint8Array(parsed._d);
        logger.info(TAG, `Unwrapped ${rawBytes.length} bytes in ${Date.now() - startTime}ms`);
        return rawBytes.slice().buffer as ArrayBuffer;
      }
    } else if (trimmed.startsWith('"')) {
      // Old format: JSON string "base64..."
      const innerString = JSON.parse(text);
      if (typeof innerString === 'string' && innerString.length > 0) {
        logger.info(TAG, `Unwrapping legacy format (from ${gatewayUrl})`);
        const rawBytes = base64ToUint8Array(innerString);
        logger.info(TAG, `Unwrapped ${rawBytes.length} bytes in ${Date.now() - startTime}ms`);
        return rawBytes.slice().buffer as ArrayBuffer;
      }
    }
    // Raw binary — return as-is (normal case for pinFileToIPFS uploads)
  } catch {
    // Not JSON — return raw bytes as-is
  }

  const duration = Date.now() - startTime;
  logger.info(TAG, `Downloaded ${data.byteLength} raw bytes in ${duration}ms`);
  return data;
}

/**
 * Download a file from IPFS and convert to Uint8Array.
 */
export async function downloadAsUint8Array(cid: string): Promise<Uint8Array> {
  const arrayBuffer = await downloadFromIPFS(cid);
  return new Uint8Array(arrayBuffer);
}

/**
 * Get a direct download URL for a CID.
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
 * Pin a CID to Pinata. Skips pinByHash on free plan (PAID_FEATURE_ONLY).
 * Files uploaded via pinFileToIPFS are already pinned.
 */
export async function pinToIPFS(cid: string): Promise<PinResult> {
  // Files uploaded via pinFileToIPFS are already pinned — skip pinByHash
  logger.info(TAG, `CID ${cid} was uploaded via pinFileToIPFS — already pinned.`);
  return { success: true, cid, service: 'Pinata' };
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
      headers: { Authorization: `Bearer ${PINATA_CONFIG.jwt}` },
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
      headers: { Authorization: `Bearer ${PINATA_CONFIG.jwt}` },
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

function base64ToUint8Array(base64: string): Uint8Array {
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
    const a = lookup[cleaned.charCodeAt(i)] || 0;
    const b = lookup[cleaned.charCodeAt(i + 1)] || 0;
    const c = lookup[cleaned.charCodeAt(i + 2)] || 0;
    const d = lookup[cleaned.charCodeAt(i + 3)] || 0;

    bytes[p++] = (a << 2) | (b >> 4);
    if (p < bufLen) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < bufLen) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes;
}
