import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// Deliberately minimal compared to web/vite.config.ts: this app has exactly one job (gate +
// sign multisig operations), so it carries none of web/'s SPA routing, i18n, or UI-kit
// machinery - fewer dependencies is itself a security property for a signing-critical site.
export default defineConfig(({ command }) => ({
  server: {
    host: '::',
    port: 8090,
  },
  plugins: [
    react(),
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
  ],
  resolve: {
    mainFields: ['browser', 'module', 'main', 'exports'],
    alias: {
      // Rollup cannot resolve the plugin's virtual shim module in production - alias to a real
      // file (mirrors web/vite.config.ts's identical workaround). Dev mode leaves the plugin's
      // own virtual module handling it.
      ...(command === 'build'
        ? { 'vite-plugin-node-polyfills/shims/process': path.resolve(__dirname, './src/lib/process-shim.ts') }
        : {}),
      '@': path.resolve(__dirname, './src'),
      '@pezkuwi/lib': path.resolve(__dirname, '../shared/lib'),
    },
    dedupe: ['react', '@pezkuwi/util-crypto', '@pezkuwi/util', '@pezkuwi/api', '@pezkuwi/extension-dapp', '@pezkuwi/keyring'],
  },
  optimizeDeps: {
    include: ['@pezkuwi/util-crypto', '@pezkuwi/util', '@pezkuwi/api', '@pezkuwi/extension-dapp', '@pezkuwi/keyring', 'buffer'],
  },
  build: {
    chunkSizeWarningLimit: 600,
  },
}));
