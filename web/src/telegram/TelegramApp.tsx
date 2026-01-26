import { useState, useEffect } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useWallet } from '@/contexts/WalletContext';
import { Loader2, Megaphone, MessageCircle, Gift, Smartphone, Wallet, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// Sections
import { AnnouncementsSection } from './components/Announcements';
import { ForumSection } from './components/Forum';
import { RewardsSection } from './components/Rewards';
import { APKSection } from './components/APK';
import { WalletSection } from './components/Wallet';

export type Section = 'announcements' | 'forum' | 'rewards' | 'apk' | 'wallet';

interface NavItem {
  id: Section;
  icon: React.ReactNode;
  label: string;
  color: string;
}

const navItems: NavItem[] = [
  { id: 'announcements', icon: <Megaphone className="w-5 h-5" />, label: 'Duyurular', color: 'text-yellow-500' },
  { id: 'forum', icon: <MessageCircle className="w-5 h-5" />, label: 'Forum', color: 'text-blue-500' },
  { id: 'rewards', icon: <Gift className="w-5 h-5" />, label: 'Rewards', color: 'text-purple-500' },
  { id: 'apk', icon: <Smartphone className="w-5 h-5" />, label: 'APK', color: 'text-green-500' },
  { id: 'wallet', icon: <Wallet className="w-5 h-5" />, label: 'Wallet', color: 'text-cyan-500' },
];

export function TelegramApp() {
  const {
    isReady: isTelegramReady,
    isTelegram,
    startParam,
    setHeaderColor,
    setBackgroundColor,
    hapticSelection,
  } = useTelegram();

  const { api, isApiReady, error: apiError } = usePezkuwi();
  const { isConnected } = useWallet();

  const [activeSection, setActiveSection] = useState<Section>('announcements');
  const [isRetrying, setIsRetrying] = useState(false);

  // Handle referral from startParam
  useEffect(() => {
    if (startParam) {
      localStorage.setItem('referrerAddress', startParam);
      console.log('[TelegramApp] Referral from startParam:', startParam);
    }
  }, [startParam]);

  // Setup Telegram theme
  useEffect(() => {
    if (isTelegram) {
      setHeaderColor('#030712'); // gray-950
      setBackgroundColor('#030712');
    }
  }, [isTelegram, setHeaderColor, setBackgroundColor]);

  const handleNavClick = (section: Section) => {
    if (isTelegram) hapticSelection();
    setActiveSection(section);
  };

  const handleRetry = () => {
    setIsRetrying(true);
    window.location.reload();
  };

  // Render active section
  const renderSection = () => {
    switch (activeSection) {
      case 'announcements':
        return <AnnouncementsSection />;
      case 'forum':
        return <ForumSection />;
      case 'rewards':
        return <RewardsSection />;
      case 'apk':
        return <APKSection />;
      case 'wallet':
        return <WalletSection />;
      default:
        return <AnnouncementsSection />;
    }
  };

  // Loading state
  if (!isTelegramReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 p-6">
        <img
          src="/shared/images/pezkuwi_wallet_logo.png"
          alt="Pezkuwi"
          className="w-20 h-20 mb-4 animate-pulse"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <Loader2 className="w-8 h-8 text-green-500 animate-spin mb-3" />
        <span className="text-gray-400 text-sm">Pezkuwi Mini App yükleniyor...</span>
      </div>
    );
  }

  // API Error state
  if (apiError && !isApiReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 p-6">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-white font-semibold text-lg mb-2">Bağlantı Hatası</h2>
        <p className="text-gray-400 text-sm text-center mb-6 max-w-xs">
          Pezkuwichain ağına bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.
        </p>
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white px-5 py-2.5 rounded-lg transition-colors"
        >
          {isRetrying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Tekrar Dene
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm">Pezkuwichain</h1>
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                isApiReady ? "bg-green-500" : "bg-yellow-500 animate-pulse"
              )} />
              <span className="text-gray-500 text-xs">
                {isApiReady ? 'Bağlı' : 'Bağlanıyor...'}
              </span>
            </div>
          </div>
        </div>

        {isConnected && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-gray-400">Cüzdan Bağlı</span>
          </div>
        )}
      </header>

      {/* API connecting banner */}
      {!isApiReady && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 flex items-center justify-center gap-2">
          <Loader2 className="w-3 h-3 text-yellow-500 animate-spin" />
          <span className="text-yellow-500 text-xs">Blockchain ağına bağlanılıyor...</span>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {renderSection()}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-gray-900 border-t border-gray-800 px-2 py-2 safe-area-bottom">
        <div className="flex items-center justify-around">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[60px]",
                activeSection === item.id
                  ? "bg-gray-800"
                  : "hover:bg-gray-800/50"
              )}
            >
              <span className={cn(
                "transition-colors",
                activeSection === item.id ? item.color : "text-gray-500"
              )}>
                {item.icon}
              </span>
              <span className={cn(
                "text-xs transition-colors",
                activeSection === item.id ? "text-white" : "text-gray-500"
              )}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default TelegramApp;
