// CRITICAL: Import crypto polyfill FIRST before anything else
console.log('🚀 [INDEX] Starting app initialization...');
console.log('📦 [INDEX] Loading react-native-get-random-values...');
import 'react-native-get-random-values';
console.log('✅ [INDEX] react-native-get-random-values loaded');

// React Native polyfills for @pezkuwi packages
console.log('📦 [INDEX] Loading URL polyfill...');
import 'react-native-url-polyfill/auto';
console.log('✅ [INDEX] URL polyfill loaded');

console.log('📦 [INDEX] Setting up Buffer...');
import { Buffer } from 'buffer';

// Global polyfills for Polkadot.js
// @ts-ignore
global.Buffer = Buffer;
console.log('✅ [INDEX] Buffer configured');

// TextEncoder/TextDecoder polyfill
console.log('📦 [INDEX] Setting up TextEncoder/TextDecoder...');
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('text-encoding');
  // @ts-ignore
  global.TextEncoder = TextEncoder;
  // @ts-ignore
  global.TextDecoder = TextDecoder;
  console.log('✅ [INDEX] TextEncoder/TextDecoder configured');
} else {
  console.log('ℹ️ [INDEX] TextEncoder/TextDecoder already available');
}

// Filter out known third-party deprecation warnings
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  const message = args[0]?.toString() || '';

  // Filter react-native-web deprecation warnings
  if (message.includes('props.pointerEvents is deprecated')) {
    return;
  }

  // Pass through all other warnings
  originalWarn.apply(console, args);
};

console.log('📦 [INDEX] Loading Expo...');
import { registerRootComponent } from 'expo';
console.log('✅ [INDEX] Expo loaded');

console.log('📦 [INDEX] Loading App component...');
import App from './App';
console.log('✅ [INDEX] App component loaded');

console.log('🎯 [INDEX] All imports successful, registering root component...');

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
