import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { WalletProvider } from './contexts/WalletContext'
import { WebSocketProvider } from './contexts/WebSocketContext'
import { PolkadotProvider } from './contexts/PolkadotContext'
import './index.css'
import './i18n/config'

// Add window.ethereum type declaration
declare global {
  interface Window {
    ethereum?: any;
  }
}

// Remove dark mode class addition
createRoot(document.getElementById("root")!).render(
  <PolkadotProvider endpoint="ws://127.0.0.1:9944">
    <WalletProvider>
      <WebSocketProvider>
        <App />
      </WebSocketProvider>
    </WalletProvider>
  </PolkadotProvider>
);
