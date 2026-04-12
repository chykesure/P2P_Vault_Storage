// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FileVault
 * @dev Decentralized file registry smart contract.
 *      Maps wallet addresses to their encrypted file CIDs stored on IPFS.
 *
 * Network: Ethereum Sepolia Testnet (or Polygon)
 */
contract FileVault {

    // ========================================
    // Data Structures
    // ========================================

    struct FileRecord {
        string cid;              // IPFS Content Identifier
        string fileName;         // Original file name (encrypted)
        uint256 fileSize;        // File size in bytes
        string fileType;         // MIME type (e.g., "image/jpeg")
        uint256 timestamp;       // Upload timestamp (Unix epoch)
        bool exists;             // Existence flag (for safe lookup)
    }

    // ========================================
    // State Variables
    // ========================================

    // Owner of the contract (deployer)
    address public owner;

    // Mapping: user address => file index => FileRecord
    mapping(address => mapping(uint256 => FileRecord)) private userFiles;

    // Mapping: user address => total file count
    mapping(address => uint256) private userFileCount;

    // Mapping: user address => file CID => file index (for dedup lookup)
    mapping(address => mapping(string => uint256)) private fileIndexMap;

    // Total number of users who have uploaded at least one file
    uint256 public totalUsers;

    // Total number of files across all users
    uint256 public totalFiles;

    // ========================================
    // Events
    // ========================================

    event FileUploaded(
        address indexed user,
        string cid,
        string fileName,
        uint256 fileSize,
        uint256 timestamp
    );

    event FileDeleted(
        address indexed user,
        string cid,
        uint256 timestamp
    );

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    // ========================================
    // Modifiers
    // ========================================

    modifier onlyOwner() {
        require(msg.sender == owner, "FileVault: caller is not the owner");
        _;
    }

    // ========================================
    // Constructor
    // ========================================

    constructor() {
        owner = msg.sender;
    }

    // ========================================
    // Write Functions
    // ========================================

    /**
     * @dev Upload a new file record to the vault
     * @param _cid The IPFS Content Identifier of the encrypted file
     * @param _fileName The original file name (should be encrypted before passing)
     * @param _fileSize Size of the encrypted file in bytes
     * @param _fileType MIME type of the file
     */
    function addFile(
        string calldata _cid,
        string calldata _fileName,
        uint256 _fileSize,
        string calldata _fileType
    ) external {
        require(bytes(_cid).length > 0, "FileVault: CID cannot be empty");
        require(bytes(_fileName).length > 0, "FileVault: file name cannot be empty");
        require(_fileSize > 0, "FileVault: file size must be greater than zero");

        // Check for duplicate CID for this user
        require(
            fileIndexMap[msg.sender][_cid] == 0,
            "FileVault: file with this CID already exists for this user"
        );

        uint256 fileIndex = userFileCount[msg.sender];

        // Store file record
        userFiles[msg.sender][fileIndex] = FileRecord({
            cid: _cid,
            fileName: _fileName,
            fileSize: _fileSize,
            fileType: _fileType,
            timestamp: block.timestamp,
            exists: true
        });

        // Update index map for dedup
        fileIndexMap[msg.sender][_cid] = fileIndex + 1; // +1 because 0 means "not found"

        // Increment counters
        userFileCount[msg.sender]++;
        totalFiles++;

        // Track new users
        if (userFileCount[msg.sender] == 1) {
            totalUsers++;
        }

        emit FileUploaded(msg.sender, _cid, _fileName, _fileSize, block.timestamp);
    }

    /**
     * @dev Remove a file record from the vault
     * @param _cid The IPFS Content Identifier to remove
     */
    function removeFile(string calldata _cid) external {
        uint256 index = fileIndexMap[msg.sender][_cid];
        require(index > 0, "FileVault: file not found for this user");

        // Convert from 1-based to 0-based index
        uint256 actualIndex = index - 1;

        // Mark as deleted
        userFiles[msg.sender][actualIndex].exists = false;

        // Remove from index map
        delete fileIndexMap[msg.sender][_cid];

        emit FileDeleted(msg.sender, _cid, block.timestamp);
    }

    /**
     * @dev Transfer contract ownership
     * @param _newOwner Address of the new owner
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "FileVault: new owner is the zero address");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }

    // ========================================
    // Read Functions
    // ========================================

    /**
     * @dev Get all files for a specific user
     * @param _user The address to query
     * @return cids Array of file CIDs
     * @return fileNames Array of file names
     * @return fileSizes Array of file sizes
     * @return fileTypes Array of MIME types
     * @return timestamps Array of upload timestamps
     * @return existsFlags Array of existence flags
     */
    function getFiles(address _user) external view returns (
        string[] memory cids,
        string[] memory fileNames,
        uint256[] memory fileSizes,
        string[] memory fileTypes,
        uint256[] memory timestamps,
        bool[] memory existsFlags
    ) {
        uint256 count = userFileCount[_user];
        cids = new string[](count);
        fileNames = new string[](count);
        fileSizes = new uint256[](count);
        fileTypes = new string[](count);
        timestamps = new uint256[](count);
        existsFlags = new bool[](count);

        for (uint256 i = 0; i < count; i++) {
            FileRecord storage file = userFiles[_user][i];
            cids[i] = file.cid;
            fileNames[i] = file.fileName;
            fileSizes[i] = file.fileSize;
            fileTypes[i] = file.fileType;
            timestamps[i] = file.timestamp;
            existsFlags[i] = file.exists;
        }

        return (cids, fileNames, fileSizes, fileTypes, timestamps, existsFlags);
    }

    /**
     * @dev Get only active (non-deleted) files for a user
     * @param _user The address to query
     * @return Active file records as arrays
     */
    function getActiveFiles(address _user) external view returns (
        string[] memory cids,
        string[] memory fileNames,
        uint256[] memory fileSizes,
        string[] memory fileTypes,
        uint256[] memory timestamps
    ) {
        uint256 count = userFileCount[_user];

        // First pass: count active files
        uint256 activeCount = 0;
        for (uint256 i = 0; i < count; i++) {
            if (userFiles[_user][i].exists) {
                activeCount++;
            }
        }

        // Allocate arrays
        cids = new string[](activeCount);
        fileNames = new string[](activeCount);
        fileSizes = new uint256[](activeCount);
        fileTypes = new string[](activeCount);
        timestamps = new uint256[](activeCount);

        // Second pass: fill arrays
        uint256 currentIndex = 0;
        for (uint256 i = 0; i < count; i++) {
            if (userFiles[_user][i].exists) {
                FileRecord storage file = userFiles[_user][i];
                cids[currentIndex] = file.cid;
                fileNames[currentIndex] = file.fileName;
                fileSizes[currentIndex] = file.fileSize;
                fileTypes[currentIndex] = file.fileType;
                timestamps[currentIndex] = file.timestamp;
                currentIndex++;
            }
        }

        return (cids, fileNames, fileSizes, fileTypes, timestamps);
    }

    /**
     * @dev Get file count for a user
     * @param _user The address to query
     * @return Number of files (including deleted)
     */
    function getFileCount(address _user) external view returns (uint256) {
        return userFileCount[_user];
    }

    /**
     * @dev Get active file count for a user
     * @param _user The address to query
     * @return Number of active (non-deleted) files
     */
    function getActiveFileCount(address _user) external view returns (uint256) {
        uint256 count = userFileCount[_user];
        uint256 activeCount = 0;
        for (uint256 i = 0; i < count; i++) {
            if (userFiles[_user][i].exists) {
                activeCount++;
            }
        }
        return activeCount;
    }

    /**
     * @dev Check if a specific CID exists for a user
     * @param _user The address to query
     * @param _cid The CID to check
     * @return Whether the file exists
     */
    function hasFile(address _user, string calldata _cid) external view returns (bool) {
        return fileIndexMap[_user][_cid] > 0;
    }

    /**
     * @dev Get contract stats
     * @return _totalUsers Total number of unique users
     * @return _totalFiles Total number of files uploaded
     */
    function getStats() external view returns (uint256 _totalUsers, uint256 _totalFiles) {
        return (totalUsers, totalFiles);
    }
}
