import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';

import { Buffer } from 'buffer';
global.Buffer = Buffer;

import { registerRootComponent } from 'expo';

import Expo from 'expo';
import * as Crypto from 'expo-crypto';
ExpoCrypto.getCrypto().getRandomValues = Crypto.getRandomValues;

import App from './app/_layout';

registerRootComponent(App);