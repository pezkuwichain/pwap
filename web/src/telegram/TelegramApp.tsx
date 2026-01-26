import { useState, useEffect } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { usePezkuwiApi } from './hooks/usePezkuwiApi';
import { Sidebar, Section, Announcements, Forum, Rewards, APK, Wallet } from './components';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

export function TelegramApp() {
  const {
    isReady: isTelegramReady,
    isTelegram,
    user,
    startParam,
    colorScheme,
    setHeaderColor,
    setBackgroundColor,
    enableClosingConfirmation,
  } = useTelegram();

  const { isReady: isApiReady, error: apiError, reconnect, isConnecting } = usePezkuwiApi();

  const [activeSection, setActiveSection] = useState<Section>('announcements');

  // Handle referral from startParam
  useEffect(() => {
    if (startParam) {
      // Store referral address in localStorage for later use
      localStorage.setItem('referrerAddress', startParam);
      if (import.meta.env.DEV) {
        console.log('[TelegramApp] Referral address from startParam:', startParam);
      }
    }
  }, [startParam]);

  // Setup Telegram theme colors
  useEffect(() => {
    if (isTelegram) {
      // Set header and background colors to match our dark theme
      setHeaderColor('#111827'); // gray-900
      setBackgroundColor('#111827');

      // Enable closing confirmation when user has unsaved changes
      // (disabled for now, can be enabled per-section)
      // enableClosingConfirmation();
    }
  }, [isTelegram, setHeaderColor, setBackgroundColor]);

  // Render the active section content
  const renderContent = () => {
    switch (activeSection) {
      case 'announcements':
        return <Announcements />;
      case 'forum':
        return <Forum />;
      case 'rewards':
        return <Rewards />;
      case 'apk':
        return <APK />;
      case 'wallet':
        return <Wallet />;
      default:
        return <Announcements />;
    }
  };

  // Loading state
  if (!isTelegramReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
          <span className="text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  // API connection error
  if (apiError && !isConnecting) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-white font-semibold">Connection Error</h2>
          <p className="text-gray-400 text-sm max-w-xs">
            Unable to connect to Pezkuwichain network. Please check your connection and try again.
          </p>
          <button
            onClick={reconnect}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-screen bg-gray-950 text-white overflow-hidden ${
        colorScheme === 'light' ? 'theme-light' : 'theme-dark'
      }`}
    >
      {/* Sidebar */}
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-900">
        {/* API connecting indicator */}
        {!isApiReady && isConnecting && (
          <div className="bg-yellow-900/30 border-b border-yellow-700/50 px-4 py-2 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
            <span className="text-yellow-500 text-sm">Connecting to network...</span>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default TelegramApp;
