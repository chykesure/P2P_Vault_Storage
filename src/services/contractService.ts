/**
 * Contract Service
 *
 * Provides functions to interact with the FileVault smart contract.
 * Handles:
 * - Uploading file records (addFile)
 * - Fetching user's file list (getActiveFiles)
 * - Removing file records (removeFile)
 * - Querying contract stats
 *
 * Note: This service provides both wagmi hook wrappers AND standalone
 * ethers-based functions for maximum flexibility.
 */

import { getPublicClient, getWalletClient, writeContract, readContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import type { Address } from 'viem';

import { FILE_VAULT_CONFIG, GAS_ESTIMATES } from '@config/contract';
import { getCurrentChainConfig } from '@config/network';
import { VaultFile, AddFileParams, ContractTxReceipt, ContractStats } from '@/types';
import { logger } from '@utils/logger';

const TAG = 'Contract';

// ========================================
// Write Operations (Require Wallet)
// ========================================

/**
 * Upload a file record to the smart contract.
 * This records the CID on-chain so the user can retrieve their file list.
 *
 * @param params - File record parameters (cid, fileName, fileSize, fileType)
 * @returns Transaction hash
 */
export async function addFileRecord(
  params: AddFileParams,
): Promise<`0x${string}`> {
  logger.info(TAG, `Adding file record: ${params.cid}`);
  logger.debug(TAG, `File: ${params.fileName}, Size: ${params.fileSize}, Type: ${params.fileType}`);

  try {
    const hash = await writeContract({
      ...FILE_VAULT_CONFIG,
      functionName: 'addFile',
      args: [
        params.cid,
        params.fileName,
        BigInt(params.fileSize),
        params.fileType,
      ],
      gas: GAS_ESTIMATES.addFile,
    });

    logger.info(TAG, `File record added. TX: ${hash}`);
    return hash;
  } catch (error: any) {
    logger.error(TAG, 'Failed to add file record:', error);

    // Provide user-friendly error messages
    if (error?.message?.includes('User rejected')) {
      throw new Error('Transaction rejected by user.');
    }
    if (error?.message?.includes('insufficient funds')) {
      throw new Error('Insufficient funds for gas. Please add ETH to your wallet.');
    }
    if (error?.message?.includes('CID cannot be empty')) {
      throw new Error('Invalid file: CID is empty.');
    }
    if (error?.message?.includes('already exists')) {
      throw new Error('This file has already been uploaded to the vault.');
    }

    throw new Error(`Failed to record file on blockchain: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Remove a file record from the smart contract.
 * Note: This only removes the on-chain record. The encrypted file
 * remains on IPFS until garbage collected (if not pinned).
 *
 * @param cid - The CID to remove from the user's file list
 * @returns Transaction hash
 */
export async function removeFileRecord(cid: string): Promise<`0x${string}`> {
  logger.info(TAG, `Removing file record: ${cid}`);

  try {
    const hash = await writeContract({
      ...FILE_VAULT_CONFIG,
      functionName: 'removeFile',
      args: [cid],
      gas: GAS_ESTIMATES.removeFile,
    });

    logger.info(TAG, `File record removed. TX: ${hash}`);
    return hash;
  } catch (error: any) {
    logger.error(TAG, 'Failed to remove file record:', error);

    if (error?.message?.includes('User rejected')) {
      throw new Error('Transaction rejected by user.');
    }
    if (error?.message?.includes('file not found')) {
      throw new Error('File not found in your vault.');
    }

    throw new Error(`Failed to remove file record: ${error?.message || 'Unknown error'}`);
  }
}

// ========================================
// Read Operations (No Wallet Required)
// ========================================

/**
 * Get all active files for the current connected wallet.
 *
 * @param userAddress - The wallet address to query
 * @returns Array of VaultFile objects
 */
export async function getUserFiles(userAddress: Address): Promise<VaultFile[]> {
  logger.info(TAG, `Fetching files for: ${userAddress}`);

  try {
    const [cids, fileNames, fileSizes, fileTypes, timestamps] = await readContract({
      ...FILE_VAULT_CONFIG,
      functionName: 'getActiveFiles',
      args: [userAddress],
    }) as [string[], string[], bigint[], string[], bigint[]];

    const files: VaultFile[] = cids.map((cid, index) => ({
      cid,
      fileName: fileNames[index],
      fileSize: Number(fileSizes[index]),
      fileType: fileTypes[index],
      timestamp: Number(timestamps[index]),
      isActive: true,
    }));

    logger.info(TAG, `Found ${files.length} active files`);
    return files;
  } catch (error: any) {
    logger.error(TAG, 'Failed to fetch user files:', error);
    throw new Error(`Failed to load files: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Get all files (including deleted) for a user.
 *
 * @param userAddress - The wallet address to query
 * @returns Array of VaultFile objects (including deleted ones)
 */
export async function getAllUserFiles(userAddress: Address): Promise<VaultFile[]> {
  logger.info(TAG, `Fetching all files (including deleted) for: ${userAddress}`);

  try {
    const [cids, fileNames, fileSizes, fileTypes, timestamps, existsFlags] = await readContract({
      ...FILE_VAULT_CONFIG,
      functionName: 'getFiles',
      args: [userAddress],
    }) as [string[], string[], bigint[], string[], bigint[], boolean[]];

    const files: VaultFile[] = cids.map((cid, index) => ({
      cid,
      fileName: fileNames[index],
      fileSize: Number(fileSizes[index]),
      fileType: fileTypes[index],
      timestamp: Number(timestamps[index]),
      isActive: existsFlags[index],
    }));

    logger.info(TAG, `Found ${files.length} total files (${files.filter(f => f.isActive).length} active)`);
    return files;
  } catch (error: any) {
    logger.error(TAG, 'Failed to fetch all user files:', error);
    throw new Error(`Failed to load files: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Get the count of active files for a user.
 */
export async function getActiveFileCount(userAddress: Address): Promise<number> {
  try {
    const count = await readContract({
      ...FILE_VAULT_CONFIG,
      functionName: 'getActiveFileCount',
      args: [userAddress],
    }) as bigint;

    return Number(count);
  } catch (error: any) {
    logger.error(TAG, 'Failed to get file count:', error);
    return 0;
  }
}

/**
 * Check if a specific CID exists for a user.
 */
export async function hasFile(userAddress: Address, cid: string): Promise<boolean> {
  try {
    const exists = await readContract({
      ...FILE_VAULT_CONFIG,
      functionName: 'hasFile',
      args: [userAddress, cid],
    }) as boolean;

    return exists;
  } catch (error) {
    logger.error(TAG, 'Failed to check file existence:', error);
    return false;
  }
}

/**
 * Get global contract statistics.
 */
export async function getContractStats(): Promise<ContractStats> {
  try {
    const [totalUsers, totalFiles] = await readContract({
      ...FILE_VAULT_CONFIG,
      functionName: 'getStats',
      args: [],
    }) as [bigint, bigint];

    return {
      totalUsers: Number(totalUsers),
      totalFiles: Number(totalFiles),
    };
  } catch (error) {
    logger.error(TAG, 'Failed to get contract stats:', error);
    return { totalUsers: 0, totalFiles: 0 };
  }
}

/**
 * Get the contract owner address.
 */
export async function getContractOwner(): Promise<Address> {
  try {
    const owner = await readContract({
      ...FILE_VAULT_CONFIG,
      functionName: 'owner',
      args: [],
    }) as Address;

    return owner;
  } catch (error) {
    logger.error(TAG, 'Failed to get contract owner:', error);
    return '0x0000000000000000000000000000000000000000' as Address;
  }
}

// ========================================
// Transaction Helpers
// ========================================

/**
 * Wait for a transaction to be confirmed.
 *
 * @param txHash - Transaction hash to monitor
 * @param confirmations - Number of blocks to wait for confirmation
 * @returns Transaction receipt
 */
export async function waitForConfirmation(
  txHash: `0x${string}`,
  confirmations: number = 1,
): Promise<ContractTxReceipt> {
  const chainConfig = getCurrentChainConfig();

  logger.info(TAG, `Waiting for TX confirmation: ${txHash}`);

  try {
    const publicClient = getPublicClient();

    if (!publicClient) {
      throw new Error('Public client not available. Make sure wallet is connected.');
    }

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations,
      timeout: 60_000,
    });

    const txReceipt: ContractTxReceipt = {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status === 'success',
    };

    if (txReceipt.status) {
      logger.info(TAG, `TX confirmed in block ${txReceipt.blockNumber}`);
      logger.info(TAG, `Explorer: ${chainConfig.blockExplorerTxUrl}${txHash}`);
    } else {
      logger.error(TAG, `TX failed: ${txHash}`);
    }

    return txReceipt;
  } catch (error: any) {
    logger.error(TAG, 'Error waiting for TX confirmation:', error);
    throw new Error(`Transaction confirmation timeout: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Estimate gas for an addFile operation.
 */
export async function estimateAddFileGas(
  params: AddFileParams,
): Promise<bigint> {
  try {
    const publicClient = getPublicClient();
    if (!publicClient) {
      return GAS_ESTIMATES.addFile;
    }

    const gas = await publicClient.estimateContractGas({
      ...FILE_VAULT_CONFIG,
      functionName: 'addFile',
      args: [
        params.cid,
        params.fileName,
        BigInt(params.fileSize),
        params.fileType,
      ],
      account: '0x0000000000000000000000000000000000000001' as Address,
    });

    // Add 20% buffer
    return (gas * 120n) / 100n;
  } catch {
    return GAS_ESTIMATES.addFile;
  }
}
