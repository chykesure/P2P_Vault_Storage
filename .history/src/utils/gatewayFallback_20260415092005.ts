/**
 * Gateway Fallback Utility
 *
 * Tries each IPFS gateway in order until one succeeds.
 * No health checks — they were causing false negatives
 * (e.g., Pinata auth endpoint needs JWT which we don't send).
 *
 * Just try each gateway directly. Simple and reliable.
 */

import { IPFS_GATEWAYS } from '@config/ipfs';

/**
 * Download a CID by trying gateways in order.
 * Skips HTML responses (error pages) and empty responses.
 * Returns the first successful result.
 */
export async function fetchWithFallback(
  cid: string,
): Promise<{ data: ArrayBuffer; gatewayUrl: string }> {
  const errors: string[] = [];

  for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
    const gateway = IPFS_GATEWAYS[i];
    const url = `${gateway.downloadUrl}${cid}`;
    console.log(`[Gateway] (${i + 1}/${IPFS_GATEWAYS.length}) Trying ${gateway.name}: ${url}`);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);

      const response = await fetch(url, {
        headers: { Accept: '*/*' },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      console.log(`[Gateway] ${gateway.name} → HTTP ${response.status}`);

      if (!response.ok) {
        errors.push(`${gateway.name}: HTTP ${response.status}`);
        continue;
      }

      // Skip HTML responses — gateways return HTML error pages even with 200
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        console.warn(`[Gateway] ${gateway.name} returned HTML, skipping`);
        errors.push(`${gateway.name}: returned HTML (error page)`);
        continue;
      }

      const data = await response.arrayBuffer();

      if (data.byteLength === 0) {
        console.warn(`[Gateway] ${gateway.name} returned 0 bytes`);
        errors.push(`${gateway.name}: empty response`);
        continue;
      }

      console.log(`[Gateway] SUCCESS from ${gateway.name}: ${data.byteLength} bytes`);
      return { data, gatewayUrl: gateway.downloadUrl };
    } catch (error: any) {
      const msg = error?.name === 'AbortError' ? 'timeout (20s)' : (error?.message || String(error));
      console.warn(`[Gateway] ${gateway.name} failed: ${msg}`);
      errors.push(`${gateway.name}: ${msg}`);
    }
  }

  const errorMsg = `All IPFS gateways failed:\n${errors.join('\n')}`;
  console.error(`[Gateway] ${errorMsg}`);
  throw new Error(errorMsg);
}

/**
 * Reset gateway cache (kept for API compatibility — no-op now).
 */
export function resetGatewayCache(): void {
  // Health checks removed — nothing to reset
}