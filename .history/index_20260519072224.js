/**
 * @format
 * 
 * Expo entry point.
 * In Expo projects, App.tsx is the root component.
 * Expo's bundler handles registration automatically.
 */

// Polyfill for react-native-get-random-values (needed by wagmi/viem)
import 'react-native-url-polyfill/auto';import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import process from 'process';

global.Buffer = Buffer;
global.process = process;





global.process = require('process');

import 'react-native-get-random-values';

// Import the root App component
import App from './src/App';

export default App;
