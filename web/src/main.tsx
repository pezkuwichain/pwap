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
