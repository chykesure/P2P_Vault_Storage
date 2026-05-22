// Web3 global polyfills - MUST run before everything
import '@walletconnect/react-native-compat';

// Fix window.addEventListener for WalletConnect/MetaMask
if (typeof window === 'undefined') {
  global.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
    location: { href: '', origin: '', protocol: '' },
    navigator: { userAgent: '', onLine: true },
    setTimeout: setTimeout,
    setInterval: setInterval,
    clearTimeout: clearTimeout,
    clearInterval: clearInterval,
  };
}

// Fix localStorage
if (typeof localStorage === 'undefined') {
  global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    get length() { return 0; },
    key: () => null,
  };
}

// Other polyfills
import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';

import { Buffer } from 'buffer';
global.Buffer = Buffer;

// EXPO ROUTER ENTRY - do NOT use registerRootComponent
import 'expo-router/entry';