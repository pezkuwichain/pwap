const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// --- Configuration ---
// Try multiple possible locations for Pezkuwi-SDK (local dev vs CI)
const possibleSdkPaths = [
    path.join(__dirname, '..', '..', 'Pezkuwi-SDK'),  // Local: /home/user/Pezkuwi-SDK
    path.join(__dirname, '..', 'Pezkuwi-SDK'),        // CI: /home/runner/work/pwap/pwap/Pezkuwi-SDK
];
const pezkuwiSdkRoot = possibleSdkPaths.find(p => fs.existsSync(p)) || possibleSdkPaths[0];
const sdkDocsSourcePath = path.join(pezkuwiSdkRoot, 'docs', 'sdk');
const mainDocsSourcePath = path.join(pezkuwiSdkRoot, 'docs'); // This is where whitepaper.md etc. are
const publicPath = path.join(__dirname, 'public');
const publicDocsPath = path.join(publicPath, 'docs'); // Where markdown/rs files will be copied
const rustdocDestPath = path.join(publicPath, 'sdk_docs'); // Destination for BUILT rustdocs (e.g., public/sdk_docs/pezkuwi_sdk_docs/index.html)
const structureOutputPath = path.join(publicPath, 'docs-structure.json');
const rustdocBuildOutputPath = path.join(pezkuwiSdkRoot, 'target', 'doc'); // Output of cargo doc

// Absolute path to rustup (used to build rustdoc)
const rustupPath = '/home/mamostehp/.cargo/bin/rustup';

// Path to the rebranding script (now .cjs)
const rebrandScriptPath = path.join(__dirname, 'rebrand-rustdoc.cjs');


// --- Helper Functions ---

function runCommand(command, args, cwd) {
    console.log(`\n> Running command: ${command} ${args.join(' ')} in ${cwd}`);
    const result = spawnSync(command, args, { stdio: 'inherit', cwd });
    if (result.error) {
        console.error(`Error executing command: ${command}`);
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`Command "${command} ${args.join(' ')}" failed with exit code ${result.status}`);
    }
}

function copyRecursive(src, dest) {
    console.log(`↪️ Copying from ${src} to ${dest}...`);
    fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(src, dest, { recursive: true });
}

function removeDir(dir) {
    console.log(`🧹 Clearing directory: ${dir}...`);
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

// Files that should be explicitly grouped under "General Docs"
const generalCategoryFileNames = [
    'AUDIT.md',
    'BACKPORT.md',
    'RELEASE.md',
    'runtimes-pallets.md',
    'workflow_rebranding.md'
];

function generateRecursiveStructure(currentDir) {
    const currentStructure = {};
    const items = fs.readdirSync(currentDir);

    items.sort((a, b) => {
        try {
            const aIsDir = fs.statSync(path.join(currentDir, a)).isDirectory();
            const bIsDir = fs.statSync(path.join(currentDir, b)).isDirectory();
            if (aIsDir && !bIsDir) return -1; // Directories first
            if (!aIsDir && bIsDir) return 1;
            return a.localeCompare(b); // Then alphabetical
        } catch (e) {
            return 0;
        }
    });

    for (const item of items) {
        const ignoreList = ['images', 'sdk', 'target', 'Cargo.toml', 'build.rs'];
        if (ignoreList.includes(item) || item.startsWith('.') || item === 'Cargo.lock') {
            continue;
        }

        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        let title = item.replace(/\.(md|rs)$/, '');
        title = title.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        const relativePath = path.relative(mainDocsSourcePath, fullPath).replace(/\\/g, '/');

        if (stat.isDirectory()) {
            const subStructure = generateRecursiveStructure(fullPath);
            if (Object.keys(subStructure).length > 0) {
                currentStructure[title] = subStructure;
            }
        } else if (item.endsWith('.md') || item.endsWith('.rs')) {
            currentStructure[title] = relativePath;
        }
    }
    return currentStructure;
}


// --- Main Execution ---

function main() {
    try {
        console.log('--- Documentation Automation ---');
        console.log(`Pezkuwi-SDK Root: ${pezkuwiSdkRoot}`);
        console.log(`SDK Docs Source: ${sdkDocsSourcePath}`);
        console.log(`Main Docs Source: ${mainDocsSourcePath}`);

        // 1. Build the Rust SDK documentation (if tools available)
        console.log('\n--- Step 1: Building SDK Documentation (Attempting) ---');
        let rustdocBuiltSuccessfully = false;
        try {
            runCommand(rustupPath, ['run', 'stable', 'cargo', 'doc', '--no-deps'], sdkDocsSourcePath);
            console.log('✅ SDK documentation built successfully.');
            rustdocBuiltSuccessfully = true;
        } catch (e) {
            console.warn(`⚠️ Warning: Could not build SDK documentation. Error: ${e.message}`);
            console.warn('           This might be due to missing Rust toolchain or environment issues. Proceeding without building rustdoc.');
        }

        // 2. Perform Rebranding on the Built Rustdoc (if built)
        if (rustdocBuiltSuccessfully && fs.existsSync(rustdocBuildOutputPath)) {
            console.log('\n--- Step 2: Rebranding Built SDK Documentation ---');
            runCommand('node', [rebrandScriptPath, rustdocBuildOutputPath], __dirname); // Run rebranding script
            console.log('✅ Built SDK docs rebranded successfully.');
        }


        // 3. Clean up old public documentation artifacts
        console.log('\n--- Step 3: Cleaning Public Directories ---');
        removeDir(publicDocsPath);
        removeDir(rustdocDestPath);
        
        // 4. Copy main Markdown/RS files from Pezkuwi-SDK/docs to public/docs
        console.log('\n--- Step 4: Copying Main Documentation Files ---');
        if (fs.existsSync(mainDocsSourcePath)) {
            copyRecursive(mainDocsSourcePath, publicDocsPath);
            console.log('✅ Main documentation files copied successfully.');
        } else {
            console.warn(`⚠️ Warning: SDK docs source not found at ${mainDocsSourcePath}. Skipping docs copy.`);
            console.warn('           This is expected in CI environments without Pezkuwi-SDK.');
            // Create empty docs directory to prevent build errors
            fs.mkdirSync(publicDocsPath, { recursive: true });
        }

        // 5. Copy the BUILT and Rebranded Rustdoc site (if built successfully)
        if (rustdocBuiltSuccessfully && fs.existsSync(rustdocBuildOutputPath)) {
            console.log('\n--- Step 5: Copying Built and Rebranded SDK Documentation ---');
            copyRecursive(rustdocBuildOutputPath, rustdocDestPath);
            console.log('✅ Built and rebranded SDK docs copied successfully.');
        } else {
            console.warn('\n⚠️ Warning: Rustdoc build output not found or build failed. Skipping copy of built SDK docs.');
        }


        // 6. Generate the final navigation structure
        console.log('\n--- Step 6: Generating Navigation Structure ---');
        const rawStructure = fs.existsSync(mainDocsSourcePath) ? generateRecursiveStructure(mainDocsSourcePath) : {};
        
        const finalStructure = {};
        const generalDocs = {};

        // Add "Getting Started" as the first category
        finalStructure['Getting Started'] = {
            'Introduction': 'introduction.md',
            'Whitepaper': 'whitepaper/whitepaper.md'
        };

        // Items to skip (already handled in Getting Started or SDK Reference)
        const skipItems = ['Introduction', 'Whitepaper', 'Mermaid'];

        // Iterate through the raw structure to categorize
        for (const key in rawStructure) {
            // Skip items already handled
            if (skipItems.includes(key)) {
                continue;
            }
            // Check if the item is a string (a file) and if its base name is in the generalCategoryFileNames list
            if (typeof rawStructure[key] === 'string' && generalCategoryFileNames.includes(path.basename(rawStructure[key]))) {
                generalDocs[key] = rawStructure[key];
            } else {
                finalStructure[key] = rawStructure[key]; // Keep as is (folder or other direct file)
            }
        }

        // Add SDK Reference section (always visible)
        finalStructure['SDK Reference'] = {
            '📚 Rust SDK Docs': 'sdk://open',
            'Runtimes & Pallets': 'runtimes-pallets.md'
        };

        // Remove items that are moved to other categories
        if (generalDocs['Genesis Engineering Plan']) {
            delete generalDocs['Genesis Engineering Plan'];
        }
        if (generalDocs['Runtimes Pallets']) {
            delete generalDocs['Runtimes Pallets'];
        }

        // Add "General Docs" as a top-level category
        if (Object.keys(generalDocs).length > 0) {
            finalStructure['General Docs'] = generalDocs;
        }
        
        // Sort the top-level keys for consistent sidebar order
        const sortedKeys = Object.keys(finalStructure).sort((a, b) => {
            // Priority order: Getting Started, SDK Reference, General Docs, Contributor, Whitepaper, then alphabetical for others
            const order = ['Getting Started', 'SDK Reference', 'General Docs', 'Contributor', 'Whitepaper'];
            const indexA = order.indexOf(a);
            const indexB = order.indexOf(b);

            if (indexA === -1 && indexB === -1) { // Both not in priority list
                return a.localeCompare(b);
            }
            if (indexA === -1) return 1; // A not in list, B is, so B comes first
            if (indexB === -1) return -1; // B not in list, A is, so A comes first
            return indexA - indexB; // Sort by priority index
        });

        const finalSortedStructure = {};
        for (const key of sortedKeys) {
            finalSortedStructure[key] = finalStructure[key];
        }

        fs.writeFileSync(structureOutputPath, JSON.stringify(finalSortedStructure, null, 2));
        console.log(`✅ Successfully generated docs structure at ${structureOutputPath}`);

        console.log('\n🚀 Documentation automation complete!');

    } catch (error) {
        console.error('\n❌ FATAL ERROR during documentation automation:');
        console.error(error);
        process.exit(1);
    }
}

main();