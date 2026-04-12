/**
 * Formatting utilities for display purposes.
 */

/**
 * Format a file size in bytes to a human-readable string.
 * Examples: "1.5 KB", "2.3 MB", "1.1 GB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);

  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Shorten an Ethereum address for display.
 * Example: "0x1234...abcd"
 */
export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Shorten a CID for display.
 * Example: "QmXyZ...123"
 */
export function shortenCid(cid: string, startChars = 8, endChars = 4): string {
  if (!cid || cid.length <= startChars + endChars + 3) return cid || '';
  return `${cid.slice(0, startChars)}...${cid.slice(-endChars)}`;
}

/**
 * Format a Unix timestamp to a human-readable date string.
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format duration in milliseconds to a human-readable string.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

/**
 * Truncate a string to a maximum length, adding "..." if truncated.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

/**
 * Get a file extension from a file name or MIME type.
 */
export function getFileExtension(fileName: string, mimeType?: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex !== -1) {
    return fileName.slice(dotIndex + 1).toLowerCase();
  }
  if (mimeType) {
    const slashIndex = mimeType.lastIndexOf('/');
    if (slashIndex !== -1) {
      return mimeType.slice(slashIndex + 1).toLowerCase();
    }
  }
  return 'unknown';
}

/**
 * Determine if a file type is an image based on MIME type.
 */
export function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}
