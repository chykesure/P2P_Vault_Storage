#!/bin/bash

# ============================================
# P2P Storage Vault — Project Setup Script
# ============================================
# Run this script after downloading the project.
# It initializes React Native, installs pods,
# and guides you through configuration.
# ============================================

set -e

echo "🔐 P2P Storage Vault — Setup Script"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() {
    echo -e "${BLUE}[STEP $1]${NC} $2"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
print_step "0" "Checking prerequisites..."

# Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Install it from https://nodejs.org (v18+)"
    exit 1
fi
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js v18+ required. You have v$(node -v)"
    exit 1
fi
print_success "Node.js $(node -v)"

# Yarn
if ! command -v yarn &> /dev/null; then
    print_warn "Yarn not found. Installing..."
    npm install -g yarn
fi
print_success "Yarn $(yarn -v)"

# CocoaPods
if ! command -v pod &> /dev/null; then
    print_error "CocoaPods not installed. Run: sudo gem install cocoapods"
    exit 1
fi
print_success "CocoaPods"

# Watchman (optional but recommended)
if command -v watchman &> /dev/null; then
    print_success "Watchman $(watchman version)"
else
    print_warn "Watchman not installed (optional but recommended)"
fi

echo ""

# Step 1: Install dependencies
print_step "1" "Installing JavaScript dependencies..."
yarn install --frozen-lockfile 2>/dev/null || yarn install
print_success "Dependencies installed"

echo ""

# Step 2: Initialize React Native iOS
print_step "2" "Initializing React Native iOS native project..."

if [ ! -d "ios/P2PStorageVault.xcodeproj" ] && [ ! -d "ios/P2PStorageVault.xcworkspace" ]; then
    echo "   Initializing React Native iOS project..."
    npx react-native init P2PStorageVault --template react-native-template-blank-typescript --skip-git --skip-install --pm yarn 2>/dev/null || true
    
    # Copy generated ios/android directories
    if [ -d "P2PStorageVault/ios" ]; then
        cp -r P2PStorageVault/ios ./ios_temp
        rm -rf ios
        mv ios_temp ios
    fi
    if [ -d "P2PStorageVault/android" ]; then
        cp -r P2PStorageVault/android ./android_temp
        rm -rf android
        mv android_temp android
    fi
    rm -rf P2PStorageVault
    print_success "iOS project initialized"
else
    print_success "iOS project already exists"
fi

echo ""

# Step 3: Install CocoaPods
print_step "3" "Installing iOS CocoaPods..."
cd ios
pod install --repo-update
cd ..
print_success "CocoaPods installed"

echo ""

# Step 4: Environment configuration
print_step "4" "Configuring environment..."

if [ ! -f ".env" ]; then
    cp .env.example .env
    print_success "Created .env from .env.example"
else
    print_success ".env already exists"
fi

echo ""
echo "============================================"
echo -e "${YELLOW}⚠  MANUAL CONFIGURATION REQUIRED${NC}"
echo "============================================"
echo ""
echo "Open .env and update these values:"
echo ""
echo "  1. EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID"
echo "     → Get from https://cloud.walletconnect.com"
echo ""
echo "  2. EXPO_PUBLIC_CONTRACT_ADDRESS"
echo "     → Deploy FileVault.sol on Remix (Sepolia)"
echo ""
echo "  3. EXPO_PUBLIC_PINATA_JWT"
echo "     → Get from https://www.pinata.cloud (API Keys → JWT)"
echo ""
echo "============================================"
echo ""

# Step 5: How to run
print_step "5" "How to run the app:"
echo ""
echo "  Start Metro:     yarn start"
echo "  Run on iOS:      yarn ios"
echo "  Run on Android:  yarn android"
echo ""
echo -e "${GREEN}Setup complete!${NC} 🎉"
echo ""
echo "Next steps:"
echo "  1. Configure .env with your credentials (see above)"
echo "  2. Deploy FileVault.sol on Sepolia testnet"
echo "  3. Run 'yarn ios' to launch the app"
echo "  4. Create a vault password on first launch"
echo "  5. Connect your wallet (MetaMask/Trust Wallet)"
