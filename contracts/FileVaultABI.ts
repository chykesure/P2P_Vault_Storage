/**
 * TypeScript ABI for the FileVault smart contract.
 * Auto-generated from the Solidity contract for wagmi/ethers interaction.
 */
export const FILE_VAULT_ABI = [
  {
    inputs: [],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'address', name: 'previousOwner', type: 'address' },
      { indexed: false, internalType: 'address', name: 'newOwner', type: 'address' },
    ],
    name: 'OwnershipTransferred',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'address', name: 'user', type: 'address' },
      { indexed: false, internalType: 'string', name: 'cid', type: 'string' },
      { indexed: false, internalType: 'string', name: 'fileName', type: 'string' },
      { indexed: false, internalType: 'uint256', name: 'fileSize', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'FileUploaded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'address', name: 'user', type: 'address' },
      { indexed: false, internalType: 'string', name: 'cid', type: 'string' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'FileDeleted',
    type: 'event',
  },
  {
    inputs: [
      { internalType: 'string', name: '_cid', type: 'string' },
      { internalType: 'string', name: '_fileName', type: 'string' },
      { internalType: 'uint256', name: '_fileSize', type: 'uint256' },
      { internalType: 'string', name: '_fileType', type: 'string' },
    ],
    name: 'addFile',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: '_cid', type: 'string' }],
    name: 'removeFile',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '_newOwner', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalUsers',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalFiles',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '_user', type: 'address' }],
    name: 'getFiles',
    outputs: [
      { internalType: 'string[]', name: 'cids', type: 'string[]' },
      { internalType: 'string[]', name: 'fileNames', type: 'string[]' },
      { internalType: 'uint256[]', name: 'fileSizes', type: 'uint256[]' },
      { internalType: 'string[]', name: 'fileTypes', type: 'string[]' },
      { internalType: 'uint256[]', name: 'timestamps', type: 'uint256[]' },
      { internalType: 'bool[]', name: 'existsFlags', type: 'bool[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '_user', type: 'address' }],
    name: 'getActiveFiles',
    outputs: [
      { internalType: 'string[]', name: 'cids', type: 'string[]' },
      { internalType: 'string[]', name: 'fileNames', type: 'string[]' },
      { internalType: 'uint256[]', name: 'fileSizes', type: 'uint256[]' },
      { internalType: 'string[]', name: 'fileTypes', type: 'string[]' },
      { internalType: 'uint256[]', name: 'timestamps', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '_user', type: 'address' }],
    name: 'getFileCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '_user', type: 'address' }],
    name: 'getActiveFileCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '_user', type: 'address' },
      { internalType: 'string', name: '_cid', type: 'string' },
    ],
    name: 'hasFile',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getStats',
    outputs: [
      { internalType: 'uint256', name: '_totalUsers', type: 'uint256' },
      { internalType: 'uint256', name: '_totalFiles', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
