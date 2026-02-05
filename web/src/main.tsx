// Suppress console output in production
// Must be at the very top before any imports
if (typeof window !== 'undefined' && import.meta.env.PROD) {
  // Suppress console.log, debug, info in production
  const noop = () => {};
  console.log = noop;
  console.debug = noop;
  console.info = noop;

  // Filter noisy warnings but keep important ones
  const originalWarn = console.warn;
  const suppressedPatterns = [
    'RPC methods not decorated',
    'Unknown signed extensions',
    'API/INIT:',
    'REGISTRY:',
    'StorageWeightReclaim',
  ];

  console.warn = (...args: unknown[]) => {
    const msg = String(args[0] || '');
    if (suppressedPatterns.some(pattern => msg.includes(pattern))) {
      return;
    }
    originalWarn.apply(console, args);
  };
}

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n/config'

// Add window.ethereum type declaration
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    ethereum?: any;
    Buffer: any;
    global: any;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// All providers are now in App.tsx for better organization
createRoot(document.getElementById("root")!).render(<App />);
