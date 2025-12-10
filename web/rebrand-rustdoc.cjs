const fs = require('fs');
const path = require('path');

// Rebrand rules from TERMINOLOGY.md
// Rule: If we control the fork (pezkuwichain org), rebrand to our fork
// Only keep external deps we DON'T control as-is
const replacements = [
    // GitHub URL rebrand - OUR FORKS (we control these)
    // paritytech/polkadot-sdk → pezkuwichain/pezkuwi-sdk
    { old: /github\.com\/paritytech\/polkadot-sdk\/blob\/master\/polkadot\/LICENSE/g, new: 'github.com/pezkuwichain/pezkuwi-sdk/blob/main/pezkuwi/LICENSE' },
    { old: /github\.com\/paritytech\/polkadot-sdk\/blob\/master\/polkadot/g, new: 'github.com/pezkuwichain/pezkuwi-sdk/tree/main/pezkuwi' },
    { old: /github\.com\/paritytech\/polkadot-sdk/g, new: 'github.com/pezkuwichain/pezkuwi-sdk' },
    // polkadot-fellows → pezkuwichain/pezkuwi-fellows
    { old: /github\.com\/polkadot-fellows\/runtimes/g, new: 'github.com/pezkuwichain/pezkuwi-fellows/tree/main/runtimes' },
    { old: /github\.com\/polkadot-fellows\/rfcs/g, new: 'github.com/pezkuwichain/pezkuwi-fellows/tree/main/rfcs' },
    { old: /github\.com\/polkadot-fellows\/manifesto/g, new: 'github.com/pezkuwichain/pezkuwi-fellows/tree/main/manifesto' },
    { old: /github\.com\/polkadot-fellows/g, new: 'github.com/pezkuwichain/pezkuwi-fellows' },
    // paritytech/substrate-parachain-template → pezkuwichain/pezkuwi-sdk-teyrchain-template
    { old: /github\.com\/paritytech\/polkadot-sdk-parachain-template/g, new: 'github.com/pezkuwichain/pezkuwi-sdk-teyrchain-template' },
    { old: /github\.com\/paritytech\/polkadot-sdk-minimal-template/g, new: 'github.com/pezkuwichain/pezkuwi-sdk-minimal-template' },
    { old: /github\.com\/paritytech\/polkadot-sdk-solochain-template/g, new: 'github.com/pezkuwichain/pezkuwi-sdk-solochain-template' },
    // paritytech/merkle-mountain-range → pezkuwichain/merkle-mountain-range
    { old: /github\.com\/mimblewimble\/merkle-mountain-range/g, new: 'github.com/pezkuwichain/merkle-mountain-range' },
    // awesome-polkadot → awesome-hez (forked from shawntabrizi/awesome-polkadot)
    { old: /github\.com\/shawntabrizi\/awesome-polkadot/g, new: 'github.com/pezkuwichain/awesome-hez' },
    // Forum/Wiki subdomain rebrand
    { old: /forum\.polkadot\.network/g, new: 'forum.network.pezkuwichain.io' },
    { old: /wiki\.polkadot\.network/g, new: 'wiki.network.pezkuwichain.io' },
    // Polkadot ecosystem → Pezkuwi ecosystem
    { old: /Polkadot SDK/g, new: 'Pezkuwi SDK' },
    { old: /Polkadot/g, new: 'Pezkuwi' },
    { old: /polkadot/g, new: 'pezkuwi' },
    // Test networks
    { old: /Rococo/g, new: 'PezkuwiChain' },
    { old: /rococo/g, new: 'pezkuwichain' },
    { old: /Westend/g, new: 'Zagros' },
    { old: /westend/g, new: 'zagros' },
    // Parachain → TeyrChain
    { old: /Parachain/g, new: 'TeyrChain' },
    { old: /parachain/g, new: 'teyrchain' },
    // Tokens
    { old: /\bDOT\b/g, new: 'HEZ' },
    { old: /\bWND\b/g, new: 'ZGR' },
    { old: /\bROC\b/g, new: 'TYR' },
    // Keep everything else (Substrate, FRAME, Parity, Kusama, etc.) as-is - external dependencies
];

function rebrandFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    for (const rep of replacements) {
        if (content.match(rep.old)) {
            content = content.replace(rep.old, rep.new);
            changed = true;
        }
    }

    // New: Add crossorigin="anonymous" to font preloads
    const preloadFontRegex = /<link\s+rel="preload"\s+href="([^"]+\.woff2)"\s+as="font"([^>]*?)>/g;
    content = content.replace(preloadFontRegex, (match, href, attrs) => {
        if (!attrs.includes('crossorigin')) {
            changed = true;
            return `<link rel="preload" href="${href}" as="font" crossorigin="anonymous"${attrs}>`;
        }
        return match;
    });

    // Remove the broken external logo image from sidebar
    const logoContainerRegex = /<a class="logo-container"[^>]*>[\s\S]*?<img[^>]*alt="logo"[^>]*>[\s\S]*?<\/a>/g;
    if (content.match(logoContainerRegex)) {
        content = content.replace(logoContainerRegex, '');
        changed = true;
    }

    // Fix mermaid - suppress errors and show diagrams as formatted code when they fail
    if (content.includes('class="mermaid"')) {
        // Replace mermaid script with error-handling version
        content = content.replace(
            /<script type="module">import mermaid[^<]*<\/script>/g,
            `<script src="https://cdn.jsdelivr.net/npm/mermaid@9.4.3/dist/mermaid.min.js"></script>
<script>
mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    flowchart: { useMaxWidth: true, htmlLabels: true },
    suppressErrorRendering: true
});
document.addEventListener('DOMContentLoaded', async () => {
    const elements = document.querySelectorAll('.mermaid');
    for (const el of elements) {
        const code = el.textContent;
        try {
            const { svg } = await mermaid.render('mermaid-' + Math.random().toString(36).substr(2, 9), code);
            el.innerHTML = svg;
        } catch (e) {
            // On error, show as styled code block
            el.style.fontFamily = 'monospace';
            el.style.whiteSpace = 'pre';
            el.style.background = '#1e293b';
            el.style.padding = '1rem';
            el.style.borderRadius = '8px';
            el.style.color = '#94a3b8';
            el.style.fontSize = '0.85rem';
            el.style.border = '1px solid #334155';
        }
    }
});
</script>`
        );

        // Fix flowchart syntax - add direction (TD = top-down) if missing
        content = content.replace(/(<pre class="mermaid"[^>]*>)\s*flowchart\s*\n/g, '$1\nflowchart TD\n');

        // Also fix "graph" syntax which needs direction
        content = content.replace(/(<pre class="mermaid"[^>]*>)\s*graph\s*\n/g, '$1\ngraph TD\n');

        changed = true;
    }



    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  ✅ Rebranded/Fixed preload: ${filePath}`);
    } else {
        console.log(`  - No changes in: ${filePath}`);
    }
}

function traverseDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        console.warn(`Rebranding: Directory not found: ${dirPath}`);
        return;
    }

    const items = fs.readdirSync(dirPath);
    for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            traverseDir(fullPath);
        } else if (item.endsWith('.html') || item.endsWith('.css') || item.endsWith('.js')) {
            rebrandFile(fullPath);
        }
    }
}

const rustdocOutput = process.argv[2]; // Path to the built rustdoc output directory

if (!rustdocOutput) {
    console.error('Usage: node rebrand-rustdoc.js <path_to_rustdoc_output>');
    process.exit(1);
}

console.log(`\n--- Starting Rustdoc Rebranding for: ${rustdocOutput} ---`);
traverseDir(rustdocOutput);
console.log('--- Rustdoc Rebranding Complete ---');
