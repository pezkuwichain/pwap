// CRITICAL: Import crypto polyfill FIRST before anything else
if (__DEV__) console.warn('🚀 [INDEX] Starting app initialization...');
if (__DEV__) console.warn('📦 [INDEX] Loading react-native-get-random-values...');
import 'react-native-get-random-values';
if (__DEV__) console.warn('✅ [INDEX] react-native-get-random-values loaded');

// React Native polyfills for @pezkuwi packages
if (__DEV__) console.warn('📦 [INDEX] Loading URL polyfill...');
import 'react-native-url-polyfill/auto';
if (__DEV__) console.warn('✅ [INDEX] URL polyfill loaded');

if (__DEV__) console.warn('📦 [INDEX] Setting up Buffer...');
import { Buffer } from 'buffer';

// Global polyfills for Polkadot.js
// Global Buffer assignment for polyfill
global.Buffer = global.Buffer || require('buffer').Buffer;
if (__DEV__) console.warn('✅ [INDEX] Buffer configured');

// TextEncoder/TextDecoder polyfill
if (__DEV__) console.warn('📦 [INDEX] Setting up TextEncoder/TextDecoder...');
if (typeof global.TextEncoder === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TextEncoder, TextDecoder } = require('text-encoding');
  // Global TextEncoder assignment for polyfill
  global.TextEncoder = require('text-encoding').TextEncoder;
  // Global TextDecoder assignment for polyfill
  global.TextDecoder = require('text-encoding').TextDecoder;
  if (__DEV__) console.warn('✅ [INDEX] TextEncoder/TextDecoder configured');
} else {
  if (__DEV__) console.warn('ℹ️ [INDEX] TextEncoder/TextDecoder already available');
}

// Filter out known third-party deprecation warnings
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const message = args[0]?.toString() || '';

  // Filter react-native-web deprecation warnings
  if (message.includes('props.pointerEvents is deprecated')) {
    return;
  }

  // Pass through all other warnings
  originalWarn.apply(console, args);
};

if (__DEV__) console.warn('📦 [INDEX] Loading Expo...');
import { registerRootComponent } from 'expo';
if (__DEV__) console.warn('✅ [INDEX] Expo loaded');

if (__DEV__) console.warn('📦 [INDEX] Loading App component...');
import App from './App';
if (__DEV__) console.warn('✅ [INDEX] App component loaded');

if (__DEV__) console.warn('🎯 [INDEX] All imports successful, registering root component...');

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
