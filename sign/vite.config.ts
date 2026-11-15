import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// Deliberately minimal compared to web/vite.config.ts: this app has exactly one job (gate +
// sign multisig operations), so it carries none of web/'s SPA routing, i18n, or UI-kit
// machinery - fewer dependencies is itself a security property for a signing-critical site.
export default defineConfig({
  server: {
    host: '::',
    port: 8090,
  },
  // No Node polyfills: nothing here imports a Node builtin, and the few dependency call sites
  // that touch `global`/`process`/`Buffer` all guard with a typeof check first.
  plugins: [react()],
  resolve: {
    mainFields: ['browser', 'module', 'main', 'exports'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@pezkuwi/lib': path.resolve(__dirname, '../shared/lib'),
    },
    dedupe: ['react', '@pezkuwi/util-crypto', '@pezkuwi/util', '@pezkuwi/api', '@pezkuwi/extension-dapp', '@pezkuwi/keyring'],
  },
  optimizeDeps: {
    include: ['@pezkuwi/util-crypto', '@pezkuwi/util', '@pezkuwi/api', '@pezkuwi/extension-dapp', '@pezkuwi/keyring'],
  },
  build: {
    chunkSizeWarningLimit: 600,
  },
});
