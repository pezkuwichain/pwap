/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig(() => ({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    alias: {
      'vite-plugin-node-polyfills/shims/buffer': path.resolve(__dirname, './src/tests/mocks/buffer-shim.ts'),
      'vite-plugin-node-polyfills/shims/global': path.resolve(__dirname, './src/tests/mocks/global-shim.ts'),
      'vite-plugin-node-polyfills/shims/process': path.resolve(__dirname, './src/tests/mocks/process-shim.ts'),
    },
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
    nodePolyfills(),
  ].filter(Boolean),
  resolve: {
    mainFields: ['module', 'main', 'exports'],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@pezkuwi/i18n": path.resolve(__dirname, "../shared/i18n"),
      "@pezkuwi/lib": path.resolve(__dirname, "../shared/lib"),
      "@pezkuwi/utils": path.resolve(__dirname, "../shared/utils"),
      "@pezkuwi/theme": path.resolve(__dirname, "../shared/theme"),
      "@local/types": path.resolve(__dirname, "../shared/types"),
      "@pezkuwi/components": path.resolve(__dirname, "../shared/components"),
      "@shared": path.resolve(__dirname, "../shared"),
      // Fix for incorrectly published @pezkuwi packages (build dir should be package root)
      "@pezkuwi/extension-dapp": path.resolve(__dirname, "../../node_modules/@pezkuwi/extension-dapp/build"),
      "@pezkuwi/extension-inject": path.resolve(__dirname, "../../node_modules/@pezkuwi/extension-inject/build"),
    },
    dedupe: ['react', 'lucide-react', 'sonner', '@pezkuwi/util-crypto', '@pezkuwi/util', '@pezkuwi/api', '@pezkuwi/extension-dapp', '@pezkuwi/keyring'],
  },
  optimizeDeps: {
    include: ['@pezkuwi/util-crypto', '@pezkuwi/util', '@pezkuwi/api', '@pezkuwi/extension-dapp', '@pezkuwi/keyring', 'buffer'],
  },
  build: {
    rollupOptions: {
      external: [],
      onwarn(warning, warn) {
        // Suppress the buffer shim warning - it's handled by vite-plugin-node-polyfills
        if (warning.message?.includes('vite-plugin-node-polyfills/shims/buffer')) {
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks: {
          'pezkuwi': ['@pezkuwi/api', '@pezkuwi/extension-dapp', '@pezkuwi/keyring', '@pezkuwi/util', '@pezkuwi/util-crypto'],
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs', '@radix-ui/react-toast'],
          'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector']
        }
      }
    },
    chunkSizeWarningLimit: 600
  },
  assetsInclude: ['**/*.json'],
}));