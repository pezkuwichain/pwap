/// <reference types="vitest" />
import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import inject from '@rollup/plugin-inject';
import subresourceIntegrity from 'vite-plugin-subresource-integrity';

// Node globals some browser dependencies reference as free identifiers; see the file header.
const nodeGlobals = path.resolve(__dirname, './src/lib/node-globals.ts');

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    // supabase/** holds Deno tests (Deno.test + pglite) run via `deno test`,
    // not vitest — exclude them from the web (node/jsdom) test sweep.
    exclude: [...configDefaults.exclude, 'supabase/**'],
  },
  server: {
    host: "::",
    port: 8082,
    strictPort: false, // Allow automatic port selection if 8082 is busy
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
    watch: {
      usePolling: true,
    },
  },
  plugins: [
    react(),
    // SRI: production build sırasında <script>/<link> tag'lerine
    // sha384 integrity hash ekle. CDN/proxy compromise olsa bile
    // tampered asset browser tarafından load edilmez.
    command === 'build' ? subresourceIntegrity({ algorithm: 'sha384' }) : null,
  ].filter(Boolean),
  resolve: {
    mainFields: ['browser', 'module', 'main', 'exports'],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@pezkuwi/i18n": path.resolve(__dirname, "../shared/i18n"),
      "@pezkuwi/lib": path.resolve(__dirname, "../shared/lib"),
      "@pezkuwi/utils": path.resolve(__dirname, "../shared/utils"),
      "@pezkuwi/theme": path.resolve(__dirname, "../shared/theme"),
      "@local/types": path.resolve(__dirname, "../shared/types"),
      "@pezkuwi/components": path.resolve(__dirname, "../shared/components"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
    dedupe: ['react', 'lucide-react', 'sonner', '@pezkuwi/util-crypto', '@pezkuwi/util', '@pezkuwi/api', '@pezkuwi/extension-dapp', '@pezkuwi/keyring'],
  },
  optimizeDeps: {
    include: ['@pezkuwi/util-crypto', '@pezkuwi/util', '@pezkuwi/api', '@pezkuwi/extension-dapp', '@pezkuwi/keyring', 'buffer'],
    esbuildOptions: {
      inject: [nodeGlobals],
      plugins: [
        {
          // Vite's dependency scanner marks every path outside node_modules as external, and
          // esbuild refuses an external inject target; resolve it as a real file instead.
          name: 'node-globals-resolver',
          setup(build) {
            build.onResolve({ filter: /[\\/]src[\\/]lib[\\/]node-globals\.ts$/ }, () => ({ path: nodeGlobals }));
          },
        },
      ],
    },
  },
  // Strip all console.* and debugger statements from production bundles so the
  // 600+ dev-time console calls never ship. Dev keeps full logging.
  esbuild: command === 'build' ? { drop: ['console', 'debugger'] } : {},
  build: {
    rollupOptions: {
      external: [],
      plugins: [
        inject({
          Buffer: [nodeGlobals, 'Buffer'],
          global: [nodeGlobals, 'global'],
          process: [nodeGlobals, 'process'],
        }),
      ],
      output: {
        manualChunks: {
          'pezkuwi': ['@pezkuwi/api', '@pezkuwi/extension-dapp', '@pezkuwi/keyring', '@pezkuwi/util', '@pezkuwi/util-crypto'],
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs', '@radix-ui/react-toast'],
          'forms': ['react-hook-form'],
          'i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector']
        }
      }
    },
    chunkSizeWarningLimit: 600
  },
  // assetsInclude: ['**/*.json'], // Disabled: interferes with node_modules JSON imports
}));