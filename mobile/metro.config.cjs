// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// ============================================
// WORKSPACE CONFIGURATION
// ============================================

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

// Watch folders - include shared directory for cross-project imports
config.watchFolders = [workspaceRoot];

// Tell Metro where to resolve packages (both project and workspace node_modules)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// ============================================
// CUSTOM MODULE RESOLUTION
// ============================================
// Note: @pezkuwi packages have incorrect main field in npm (cjs/build/cjs/index.js)
// This is automatically fixed by scripts/fix-pezkuwi-packages.cjs via postinstall hook

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

// ============================================
// PACKAGE EXPORTS RESOLUTION
// ============================================

// Disable strict package exports checking for packages like @noble/hashes
// that don't properly export all their submodules
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
