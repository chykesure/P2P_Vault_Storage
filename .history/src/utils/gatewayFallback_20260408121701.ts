/**
 * Gateway fallback utility.
 * Provides automatic failover between IPFS gateways.
 */

import { IPFS_GATEWAYS, GatewayDefinition } from '@config/ipfs';
import { IPFSGatewayConfig } from '@/types';

/** Cache of gateway health status */
let gatewayHealthCache: Map<number, { healthy: boolean; lastChecked: number }> = new Map();

/** Health check TTL in milliseconds (5 minutes) */
const HEALTH_CHECK_TTL = 5 * 60 * 1000;

/**
 * Check if a gateway is healthy by pinging its health check endpoint.
 */
async function checkGatewayHealth(gateway: GatewayDefinition): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(gateway.healthCheckUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get all gateways sorted by health and latency.
 * Healthy gateways come first, then unhealthy ones.
 */
export async function getOrderedGateways(): Promise<IPFSGatewayConfig[]> {
  const results: IPFSGatewayConfig[] = [];

  for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
    const gateway = IPFS_GATEWAYS[i];
    const cached = gatewayHealthCache.get(i);

    // Use cached health if still valid
    if (cached && Date.now() - cached.lastChecked < HEALTH_CHECK_TTL) {
      results.push({
        url: gateway.downloadUrl,
        isHealthy: cached.healthy,
        latency: cached.healthy ? 0 : Infinity,
      });
      continue;
    }

    // Perform health check
    const startTime = Date.now();
    const healthy = await checkGatewayHealth(gateway);
    const latency = Date.now() - startTime;

    gatewayHealthCache.set(i, { healthy, lastChecked: Date.now() });

    results.push({
      url: gateway.downloadUrl,
      isHealthy: healthy,
      latency,
    });
  }

  // Sort: healthy first, then by latency
  results.sort((a, b) => {
    if (a.isHealthy && !b.isHealthy) return -1;
    if (!a.isHealthy && b.isHealthy) return 1;
    return a.latency - b.latency;
  });

  return results;
}

/**
 * Try to download from a CID by attempting gateways in order.
 * Returns the data from the first successful gateway.
 */
export async function fetchWithFallback(cid: string): Promise<{ data: ArrayBuffer; gatewayUrl: string }> {
  const gateways = await getOrderedGateways();

  for (const gateway of gateways) {
    if (!gateway.isHealthy) continue;

    try {
      const url = `${gateway.url}${cid}?format=raw`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/octet-stream' },
      });

      if (response.ok) {
        const data = await response.arrayBuffer();
        return { data, gatewayUrl: gateway.url };
      }
    } catch (error) {
      console.warn(`[Gateway Fallback] Failed to fetch from ${gateway.url}:`, error);
      continue;
    }
  }

  throw new Error('All IPFS gateways failed. Please check your internet connection and try again.');
}

/**
 * Reset the gateway health cache (useful after network changes).
 */
export function resetGatewayCache(): void {
  gatewayHealthCache.clear();
}
