# P2P Storage Vault — Expo (React Native)

A **cross-platform, decentralized, encrypted file storage** app built with **Expo** (React Native). Runs on **iOS** and **Android**. Files are encrypted on-device using AES-256-CBC before being uploaded to the IPFS peer-to-peer network. File ownership is recorded on the Ethereum blockchain via a smart contract.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│              iOS + Android (Expo Cross-Platform)      │
│  ┌────────────────────────────────────────────────┐  │
│  │            P2P Storage Vault App               │  │
│  │                                                │  │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │  │
│  │  │  Wallet   │  │ Encrypt  │  │   Upload    │  │  │
│  │  │ Connect   │──│  File    │──│   Pipeline  │  │  │
│  │  │ (Wagmi/  │  │ (AES-256)│  │             │  │  │
│  │  │  Wallet-  │  │          │  │             │  │  │
│  │  │  Connect) │  │          │  │             │  │  │
│  │  └──────────┘  └──────────┘  └──────┬──────┘  │  │
│  │                                      │         │  │
│  │  ┌──────────────────────────────────┐│         │  │
│  │  │     Smart Contract Index         ││         │  │
│  │  │  (FileVault on Ethereum/Sepolia) ││         │  │
│  │  └──────────────────────────────────┘│         │  │
│  └──────────────────────────────────────┼─────────┘  │
└─────────────────────────────────────────┼───────────┘
                                          │
                    ┌─────────────────────┴──────────────┐
                    ▼                                    ▼
          ┌──────────────┐                    ┌─────────────────┐
          │  IPFS P2P    │                    │  Ethereum       │
          │  Network     │                    │  Blockchain     │
          │  (Pinata +   │                    │  (Sepolia       │
          │   Fallback)  │                    │   Testnet)      │
          └──────────────┘                    └─────────────────┘
```

### The Four Pillars

| Pillar | Technology | Purpose |
|--------|-----------|---------|
| **A. Identity** | WalletConnect + Wagmi | Wallet-based login (no username/password) |
| **B. Encryption** | AES-256-CBC + PBKDF2 (expo-crypto) | Client-side encryption before upload |
| **C. Storage** | IPFS (Pinata + Fallbacks) | Distributed file storage |
| **D. Index** | Solidity Smart Contract | On-chain file registry |

---

## Prerequisites

### Required (all platforms)
- **Node.js** >= 18.x ([Download](https://nodejs.org))
- **npm** (comes with Node.js)
- **Expo CLI** (`npx expo` — no separate install needed)

### For iOS (Mac only)
- **Xcode** 15+ (from Mac App Store)
- **CocoaPods** (`sudo gem install cocoapods`)
- iOS Simulator or a physical iPhone

### For Android (Mac / Windows / Linux)
- **Android Studio** ([Download](https://developer.android.com/studio))
- Android SDK (API Level 34+)
- Android Emulator or physical Android device

### Required Accounts
- **WalletConnect Cloud** — [Create free project](https://cloud.walletconnect.com) for a Project ID
- **Pinata** — [Sign up free](https://www.pinata.cloud) for IPFS pinning (get JWT token)
- **MetaMask** or **Trust Wallet** on your device
- **Sepolia ETH** — Get free testnet ETH from [sepoliafaucet.com](https://sepoliafaucet.com)

---

## Quick Start

### 1. Install Dependencies

```bash
cd P2PStorageVault
npm install
```

### 2. Deploy the Smart Contract

Use [Remix IDE](https://remix.ethereum.org) to deploy:

1. Open `contracts/FileVault.sol` in Remix
2. Go to "Deploy & Run Transactions" tab
3. Select **Injected Provider — MetaMask** (connected to Sepolia)
4. Click **Deploy** → confirm in MetaMask
5. Copy the deployed contract address
6. Set it in `app.json` → `extra` → `contractAddress` (or `.env`)

### 3. Configure the App

You have **two options** to configure:

#### Option A: Edit `app.json` (Recommended — no rebuild needed)

```json
{
  "expo": {
    "extra": {
      "walletConnectProjectId": "your_real_project_id",
      "contractAddress": "0x1234...your_deployed_address",
      "pinataJwt": "your_pinata_jwt_token",
      "network": "sepolia"
    }
  }
}
```

#### Option B: Use `.env` file

```bash
cp .env.example .env
# Then edit .env with your values
```

### 4. Run the App

```bash
# Start with tunnel (for testing on your phone)
npx expo start --clear --tunnel

# Or start normally (simulator/emulator)
npx expo start --clear

# iOS only (Mac)
npx expo start --ios

# Android only
npx expo start --android
```

Then:
- **On your phone:** Scan the QR code with the **Expo Go** app
- **On simulator:** Press `i` for iOS or `a` for Android in the terminal
- Press `r` to reload, `d` for dev menu

### ⚠️ Important: WalletConnect Needs a Custom Dev Client

The Web3/WalletConnect integration requires native modules that are NOT available in Expo Go. To test wallet connectivity:

```bash
# Build a custom development client for iOS
npx expo run:ios

# Build a custom development client for Android
npx expo run:android
```

This creates a native build with WalletConnect support. You only need to do this once (or when native deps change). After that, `npx expo start` will use your custom dev client.

> **Everything else** (encryption, IPFS upload, file picker, UI) works perfectly in **Expo Go** — only the wallet connection needs the custom dev client.

### 5. First Launch Flow

1. **Create Vault Password** — Set a strong master password (min 8 chars)
2. **Connect Wallet** — Tap "Connect Wallet" → select MetaMask/Trust Wallet
3. **Upload a File** — Go to Upload tab → select file → tap "Encrypt & Upload"

---

## Project Structure

```
P2PStorageVault/
├── app.json                      # Expo project config (scheme, plugins, extra)
├── assets/                       # Icons, splash, adaptive icons
├── contracts/
│   ├── FileVault.sol             # Solidity smart contract
│   └── FileVaultABI.ts           # TypeScript ABI for wagmi
├── src/
│   ├── App.tsx                   # Root component
│   ├── types/index.ts            # TypeScript type definitions
│   ├── config/
│   │   ├── constants.ts          # App-wide constants
│   │   ├── network.ts            # Wagmi/chain config (reads expo-constants)
│   │   ├── contract.ts           # Contract addresses (reads expo-constants)
│   │   └── ipfs.ts               # IPFS gateways + Pinata config
│   ├── contexts/
│   │   ├── Web3Context.tsx        # Wallet connection context
│   │   └── EncryptionContext.tsx  # Master key lifecycle
│   ├── services/
│   │   ├── encryption.ts         # AES-256-CBC + PBKDF2 (expo-crypto)
│   │   ├── ipfsClient.ts         # IPFS upload/download/pinning
│   │   └── contractService.ts    # Smart contract interactions
│   ├── hooks/
│   │   └── useFileVault.ts       # File upload/download orchestration
│   ├── navigation/
│   │   ├── types.ts              # Navigation type definitions
│   │   └── AppNavigator.tsx      # Bottom tabs + stack navigator
│   ├── screens/
│   │   ├── HomeScreen.tsx         # Dashboard
│   │   ├── UploadScreen.tsx       # File upload (expo-document-picker)
│   │   ├── FileListScreen.tsx     # File browser with search
│   │   ├── FileDetailScreen.tsx   # File metadata & actions
│   │   ├── SettingsScreen.tsx     # App settings
│   │   ├── SetupPasswordScreen.tsx # First-launch password
│   │   └── UnlockVaultScreen.tsx  # Vault unlock
│   ├── components/
│   │   ├── FileCard.tsx           # File list item
│   │   ├── WalletConnectButton.tsx # Wallet status button
│   │   ├── PasswordSetupModal.tsx  # Password modal
│   │   ├── LoadingOverlay.tsx      # Upload progress overlay
│   │   └── ErrorBoundary.tsx       # Error catcher
│   └── utils/
│       ├── gatewayFallback.ts     # IPFS gateway failover
│       ├── logger.ts              # Structured logging
│       └── formatters.ts          # Display formatting
├── index.js                       # Entry point (polyfill + App import)
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
├── babel.config.js                # Babel config (expo preset + aliases)
├── metro.config.js                # Metro bundler config (Web3 polyfills)
├── .env.example                   # Environment variable template
└── .gitignore                     # Git ignore rules
```

---

## Key Features

### Encryption (expo-crypto)
- **AES-256-CBC** symmetric encryption for file data
- **PBKDF2-HMAC-SHA256** key derivation (100,000 iterations)
- **Per-file random keys** — each file gets a unique AES-256 key
- **Key wrapping** — AES keys encrypted with the master key
- **Master key** stored only in memory, zeroed on lock

### IPFS Integration
- **Pinata** as primary upload gateway (reliable pinning)
- **Automatic fallback** to 4 public gateways
- **Gateway health monitoring** with latency-based sorting

### Smart Contract
- Maps `walletAddress => [CID1, CID2, ...]` on-chain
- Supports add, remove, and query operations
- Deduplication — prevents uploading the same file twice

---

## Upload Flow

```
1. SELECT FILE     → expo-document-picker picks from device
2. ENCRYPT (local) → AES-256-CBC with random key + IV
3. UPLOAD (IPFS)   → Encrypted data → IPFS gateway → get CID
4. PIN             → Pinata pins the CID for persistence
5. RECORD (chain)  → addFile(cid) on smart contract → get TX hash
6. CONFIRM         → Wait for 1 block confirmation
```

---

## Troubleshooting

### "Cannot connect to wallet"
- WalletConnect needs a **custom dev client** (not Expo Go)
- Run: `npx expo run:ios` or `npx expo run:android`
- Make sure your WalletConnect Project ID is set in `app.json` → `extra`

### "Encryption not set up"
- Appears on first launch — create a password
- If it reappears, clear the app data and relaunch

### "IPFS upload failed"
- Check your Pinata JWT in `app.json` → `extra` → `pinataJwt`
- Ensure internet connectivity
- The app will fall back to public gateways automatically

### "Failed to record on blockchain"
- You need Sepolia ETH in your wallet
- Get free testnet ETH from a faucet
- Verify contract address in `app.json` → `extra`

### Build/Cache Issues
```bash
# Clear everything and restart
npx expo start --clear

# If that doesn't work:
rm -rf node_modules
npm install
npx expo start --clear
```

### "Module not found" errors
```bash
rm -rf node_modules && npm install
npx expo start --clear
```

---

## Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | Expo SDK | 51 |
| React Native | React Native | 0.74.5 |
| Platforms | iOS 17+ / Android 14+ | Cross-platform |
| Language | TypeScript | 5.3.3 |
| JS Engine | Hermes | (bundled) |
| Navigation | React Navigation 6 | 6.x |
| Web3 | Wagmi + Viem | 2.x |
| Wallet | WalletConnect v2 | 2.x |
| Crypto | expo-crypto + aes-js | 13.x |
| File Picker | expo-document-picker | 12.x |
| File System | expo-file-system | 17.x |
| Storage | expo-secure-store | 13.x |
| Icons | @expo/vector-icons | 14.x |
| Blockchain | Ethereum Sepolia | — |
| P2P Storage | IPFS + Pinata | — |

---

## Security Notes

1. **Your master password is the key to everything.** If lost, encrypted files are permanently unrecoverable.
2. **Encryption happens on-device.** No server ever receives your unencrypted files.
3. **The master key is never written to disk.** It exists only in device memory and is zeroed on lock.
4. **IPFS is public.** The CID is public, but AES-256 encryption ensures only you can read the data.
5. **The smart contract stores CIDs, not file contents.** No file data is ever on-chain.

---

## License

MIT
