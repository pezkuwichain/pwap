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

config.resolver.sourceExts = [
  'expo.ts',
  'expo.tsx',
  'expo.js',
  'expo.jsx',
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'wasm',
  'svg',
  'cjs',
  'mjs',
];

// ============================================
// NODE POLYFILLS
// ============================================

// Polyfills will be resolved from project's own node_modules

module.exports = config;
