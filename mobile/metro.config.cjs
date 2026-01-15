// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// ============================================
// WORKSPACE CONFIGURATION
// ============================================

const projectRoot = __dirname;

// Use default watchFolders (no custom configuration)

// ============================================
// CUSTOM MODULE RESOLUTION
// ============================================
// DISABLED: Custom resolver causes empty-module.js resolution issues
// Using npm packages directly instead

// ============================================
// FILE EXTENSIONS
// ============================================

// Extend default extensions instead of replacing them
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'expo.ts',
  'expo.tsx',
  'expo.js',
  'expo.jsx',
  'wasm',
];

// SVG should be handled as source file for react-native-svg transformer
// Remove svg from assetExts if present, add to sourceExts
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
if (!config.resolver.sourceExts.includes('svg')) {
  config.resolver.sourceExts.push('svg');
}

// ============================================
// NODE POLYFILLS
// ============================================

// Polyfills will be resolved from project's own node_modules

module.exports = config;
