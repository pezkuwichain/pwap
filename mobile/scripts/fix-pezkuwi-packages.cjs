#!/usr/bin/env node
/**
 * Postinstall script to fix @pezkuwi packages with incorrect main field paths
 *
 * Problem: Some @pezkuwi packages have package.json paths that don't match
 * their actual file structure. This causes Metro bundler to fail.
 *
 * This script automatically detects and fixes broken paths after npm install.
 *
 * Examples of fixes:
 *   - main: "./cjs/build/cjs/index.js" → "./cjs/index.js" (when ./cjs/index.js exists)
 */

const fs = require('fs');
const path = require('path');

// Find all possible node_modules locations
function findNodeModulesPaths() {
  const paths = [];
  let currentDir = __dirname;

  // Walk up the directory tree to find all node_modules
  while (currentDir !== path.dirname(currentDir)) {
    const nodeModulesPath = path.join(currentDir, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      paths.push(nodeModulesPath);
    }
    currentDir = path.dirname(currentDir);
  }

  return paths;
}

// Find all @pezkuwi packages in a node_modules directory
function findPezkuwiPackages(nodeModulesPath) {
  const pezkuwiDir = path.join(nodeModulesPath, '@pezkuwi');
  if (!fs.existsSync(pezkuwiDir)) {
    return [];
  }

  const packages = [];
  try {
    const entries = fs.readdirSync(pezkuwiDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const packageDir = path.join(pezkuwiDir, entry.name);
        const packageJsonPath = path.join(packageDir, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          packages.push({ dir: packageDir, packageJson: packageJsonPath });
        }
      }
    }
  } catch (err) {
    console.warn(`Warning: Could not read ${pezkuwiDir}: ${err.message}`);
  }

  return packages;
}

// Check if a file path is valid (exists)
function fileExists(packageDir, relativePath) {
  if (!relativePath) return false;
  const fullPath = path.join(packageDir, relativePath);
  return fs.existsSync(fullPath);
}

// Try to find the correct path for a broken reference
function findCorrectPath(packageDir, brokenPath) {
  if (!brokenPath) return null;

  // Pattern: "./cjs/build/cjs/index.js" should be "./cjs/index.js"
  if (brokenPath.includes('/build/cjs/')) {
    const fixedPath = brokenPath.replace('/build/cjs/', '/');
    if (fileExists(packageDir, fixedPath)) {
      return fixedPath;
    }
  }

  // Pattern: "./build/cjs/index.js" might need to be "./cjs/index.js"
  // But only if ./build/cjs/index.js doesn't exist
  if (brokenPath.startsWith('./build/cjs/') && !fileExists(packageDir, brokenPath)) {
    const fixedPath = brokenPath.replace('./build/cjs/', './cjs/');
    if (fileExists(packageDir, fixedPath)) {
      return fixedPath;
    }
  }

  return null;
}

// Fix a single package.json file
function fixPackageJson({ dir, packageJson }) {
  let content;
  try {
    content = fs.readFileSync(packageJson, 'utf8');
  } catch (err) {
    console.warn(`Warning: Could not read ${packageJson}: ${err.message}`);
    return { fixed: false, details: [] };
  }

  let pkg;
  try {
    pkg = JSON.parse(content);
  } catch (err) {
    console.warn(`Warning: Could not parse ${packageJson}: ${err.message}`);
    return { fixed: false, details: [] };
  }

  const fixes = [];

  // Check main field
  if (pkg.main && !fileExists(dir, pkg.main)) {
    const correctPath = findCorrectPath(dir, pkg.main);
    if (correctPath) {
      fixes.push({ field: 'main', from: pkg.main, to: correctPath });
      pkg.main = correctPath;
    }
  }

  // Check module field
  if (pkg.module && !fileExists(dir, pkg.module)) {
    const correctPath = findCorrectPath(dir, pkg.module);
    if (correctPath) {
      fixes.push({ field: 'module', from: pkg.module, to: correctPath });
      pkg.module = correctPath;
    }
  }

  // Check types field
  if (pkg.types && !fileExists(dir, pkg.types)) {
    // For types, try the same patterns
    let correctPath = findCorrectPath(dir, pkg.types);
    // Also try replacing .d.ts patterns
    if (!correctPath && pkg.types.includes('/build/cjs/')) {
      const fixedPath = pkg.types.replace('/build/cjs/', '/');
      if (fileExists(dir, fixedPath)) {
        correctPath = fixedPath;
      }
    }
    if (correctPath) {
      fixes.push({ field: 'types', from: pkg.types, to: correctPath });
      pkg.types = correctPath;
    }
  }

  if (fixes.length > 0) {
    try {
      fs.writeFileSync(packageJson, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      return { fixed: true, details: fixes };
    } catch (err) {
      console.error(`Error: Could not write ${packageJson}: ${err.message}`);
      return { fixed: false, details: [] };
    }
  }

  return { fixed: false, details: [] };
}

// Main function
function main() {
  console.log('--- @pezkuwi Package Path Fixer ---');

  const nodeModulesPaths = findNodeModulesPaths();
  if (nodeModulesPaths.length === 0) {
    console.log('No node_modules directories found.');
    return;
  }

  console.log(`Found ${nodeModulesPaths.length} node_modules location(s)`);

  let totalFixed = 0;
  let totalChecked = 0;

  for (const nodeModulesPath of nodeModulesPaths) {
    const packages = findPezkuwiPackages(nodeModulesPath);

    for (const pkg of packages) {
      totalChecked++;
      const result = fixPackageJson(pkg);
      if (result.fixed) {
        const relativePath = path.relative(process.cwd(), pkg.packageJson);
        console.log(`  Fixed: ${relativePath}`);
        for (const detail of result.details) {
          console.log(`    ${detail.field}: ${detail.from} → ${detail.to}`);
        }
        totalFixed++;
      }
    }
  }

  console.log(`\nChecked ${totalChecked} @pezkuwi packages, fixed ${totalFixed}`);
  console.log('--- Done ---\n');
}

main();
