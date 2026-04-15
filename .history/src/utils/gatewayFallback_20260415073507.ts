/**
 * Gateway fallback utility.
 * Tries ALL gateways in order with text() for React Native reliability.
 */

import { IPFS_GATEWAYS } from '@config/ipfs';

/**
 * Download a CID as text from the first working gateway.
 * Uses text() instead of arrayBuffer() — more reliable in React Native.
 */
export async function fetchTextWithFallback(cid: string): Promise<{ text: string; gatewayUrl: string }> {
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const url = `${gateway.downloadUrl}${cid}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        const text = await response.text();
        if (text.length > 0) {
          return { text, gatewayUrl: gateway.downloadUrl };
        }
      }
    } catch (error) {
      console.warn(`[Gateway] ${gateway.name} failed:`, error);
    }
  }

  throw new Error('All IPFS gateways failed. Please check your internet connection and try again.');
}

/**
 * Download a CID as ArrayBuffer from the first working gateway.
 */
export async function fetchWithFallback(cid: string): Promise<{ data: ArrayBuffer; gatewayUrl: string }> {
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const url = `${gateway.downloadUrl}${cid}?format=raw`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.arrayBuffer();
        if (data.byteLength > 0) {
          return { data, gatewayUrl: gateway.downloadUrl };
        }
      }
    } catch (error) {
      console.warn(`[Gateway] ${gateway.name} failed:`, error);
    }
  }

  throw new Error('All IPFS gateways failed. Please check your internet connection and try again.');
}

/**
 * Reset gateway cache.
 */
export function resetGatewayCache(): void {
  // No cache in simplified version
}