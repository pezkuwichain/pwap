import React, { useState, useEffect } from 'react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Wallet, Check, Copy, LogOut, Smartphone, Monitor, ExternalLink, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Detect if user is on mobile
const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Pezkuwi Wallet deep link
const PEZKUWI_WALLET_DEEP_LINK = 'pezkuwiwallet://';
const PLAY_STORE_LINK = 'https://play.google.com/store/apps/details?id=io.novafoundation.nova.market';
const APP_STORE_LINK = 'https://apps.apple.com/app/nova-polkadot-kusama-wallet/id1597119355';

type ConnectionMethod = 'select' | 'extension' | 'walletconnect';

export const WalletConnectModal: React.FC = () => {
  const {
    accounts,
    selectedAccount,
    setSelectedAccount,
    connectWallet,
    disconnectWallet,
    error
  } = usePezkuwi();

  const [isOpen, setIsOpen] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>('select');
  const [showAccountSelect, setShowAccountSelect] = useState(false);
  const { toast } = useToast();
  const mobile = isMobile();

  // Reset to selection when modal opens
  useEffect(() => {
    if (isOpen && !selectedAccount) {
      setConnectionMethod('select');
    }
  }, [isOpen, selectedAccount]);

  const handleConnect = () => {
    setIsOpen(true);
    setConnectionMethod('select');
  };

  const handleExtensionConnect = async () => {
    setConnectionMethod('extension');
    await connectWallet();
    if (accounts.length > 0) {
      setShowAccountSelect(true);
    }
  };

  const handleWalletConnectConnect = () => {
    setConnectionMethod('walletconnect');

    if (mobile) {
      // Try to open Pezkuwi Wallet app
      // First try deep link, then fallback to store
      const deepLink = PEZKUWI_WALLET_DEEP_LINK;

      // Create a hidden iframe to try the deep link
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = deepLink;
      document.body.appendChild(iframe);

      // Fallback to app store after timeout
      setTimeout(() => {
        document.body.removeChild(iframe);
        // Check if app was opened by checking if page is still visible
        if (!document.hidden) {
          // App didn't open, redirect to store
          const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
          window.location.href = isIOS ? APP_STORE_LINK : PLAY_STORE_LINK;
        }
      }, 2500);

      toast({
        title: "Pezkuwi Wallet açılıyor...",
        description: "Uygulama yüklü değilse mağazaya yönlendirileceksiniz",
      });
    } else {
      // Desktop - show QR code or instructions
      toast({
        title: "WalletConnect",
        description: "QR kod desteği yakında eklenecek. Şimdilik browser extension kullanın.",
      });
    }
  };

  const handleSelectAccount = (account: typeof accounts[0]) => {
    setSelectedAccount(account);
    setIsOpen(false);
    setShowAccountSelect(false);
    toast({
      title: "Hesap Bağlandı",
      description: `${account.meta.name} - ${formatAddress(account.address)}`,
    });
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setIsOpen(false);
    toast({
      title: "Cüzdan Bağlantısı Kesildi",
      description: "Cüzdanınızın bağlantısı kesildi",
    });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyAddress = () => {
    if (selectedAccount) {
      navigator.clipboard.writeText(selectedAccount.address);
      toast({
        title: "Adres Kopyalandı",
        description: "Adres panoya kopyalandı",
      });
    }
  };

  // Connected state - show account info
  if (selectedAccount) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30"
          onClick={() => setIsOpen(true)}
        >
          <Wallet className="w-4 h-4 mr-2" />
          {selectedAccount.meta.name || 'Account'}
          <Badge className="ml-2 bg-green-500/30 text-green-300 border-0">
            {formatAddress(selectedAccount.address)}
          </Badge>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDisconnect}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <LogOut className="w-4 h-4" />
        </Button>

        {/* Account Details Dialog */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="bg-gray-900 border-gray-800">
            <DialogHeader>
              <DialogTitle className="text-white">Hesap Detayları</DialogTitle>
              <DialogDescription className="text-gray-400">
                Bağlı Pezkuwi hesabınız
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Hesap Adı</div>
                <div className="text-white font-medium">
                  {selectedAccount.meta.name || 'İsimsiz Hesap'}
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Adres</div>
                <div className="flex items-center justify-between">
                  <code className="text-white text-sm font-mono break-all">
                    {selectedAccount.address}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyAddress}
                    className="text-gray-400 hover:text-white flex-shrink-0 ml-2"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Kaynak</div>
                <div className="text-white">
                  {selectedAccount.meta.source || 'pezkuwi'}
                </div>
              </div>

              {accounts.length > 1 && (
                <div>
                  <div className="text-sm text-gray-400 mb-2">Hesap Değiştir</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {accounts.map((account) => (
                      <button
                        key={account.address}
                        onClick={() => handleSelectAccount(account)}
                        className={`w-full p-3 rounded-lg border transition-all flex items-center justify-between ${
                          account.address === selectedAccount.address
                            ? 'bg-green-500/20 border-green-500/50'
                            : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className="text-left">
                          <div className="text-white font-medium">
                            {account.meta.name || 'İsimsiz'}
                          </div>
                          <div className="text-gray-400 text-xs font-mono">
                            {formatAddress(account.address)}
                          </div>
                        </div>
                        {account.address === selectedAccount.address && (
                          <Check className="w-5 h-5 text-green-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Not connected - show connect button
  return (
    <>
      <Button
        onClick={handleConnect}
        className="bg-gradient-to-r from-green-600 to-yellow-400 hover:from-green-700 hover:to-yellow-500 text-white"
      >
        <Wallet className="w-4 h-4 mr-2" />
        Cüzdan Bağla
      </Button>

      {/* Connection Method Selection Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-center text-xl">
              Cüzdan Bağla
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-center">
              Bağlantı yönteminizi seçin
            </DialogDescription>
          </DialogHeader>

          {/* Connection Method Selection */}
          {connectionMethod === 'select' && (
            <div className="space-y-3 py-4">
              {/* Browser Extension Option - Hide on mobile */}
              {!mobile && (
                <button
                  onClick={handleExtensionConnect}
                  className="w-full p-4 rounded-xl border-2 border-gray-700 bg-gray-800/50 hover:border-green-500/50 hover:bg-gray-800 transition-all text-left flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center flex-shrink-0">
                    <Monitor className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-semibold mb-1">Browser Extension</div>
                    <div className="text-gray-400 text-sm">
                      Polkadot.js veya Pezkuwi Extension ile bağlan
                    </div>
                  </div>
                </button>
              )}

              {/* Pezkuwi Wallet Option */}
              <button
                onClick={handleWalletConnectConnect}
                className="w-full p-4 rounded-xl border-2 border-gray-700 bg-gray-800/50 hover:border-yellow-500/50 hover:bg-gray-800 transition-all text-left flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                  <Smartphone className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold mb-1">Pezkuwi Wallet</div>
                  <div className="text-gray-400 text-sm">
                    {mobile
                      ? 'Pezkuwi Wallet uygulamasını aç'
                      : 'QR kod ile mobil cüzdanla bağlan'}
                  </div>
                </div>
                {!mobile && (
                  <QrCode className="w-5 h-5 text-gray-500" />
                )}
              </button>

              {/* Download Wallet Link */}
              <div className="pt-2 text-center">
                <a
                  href={mobile ? ((/iPhone|iPad|iPod/i.test(navigator.userAgent)) ? APP_STORE_LINK : PLAY_STORE_LINK) : PLAY_STORE_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-500 hover:text-gray-400 inline-flex items-center gap-1"
                >
                  Pezkuwi Wallet&apos;ı indir
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* Extension Error State */}
          {connectionMethod === 'extension' && error && error.includes('not found') && (
            <div className="space-y-4 py-4">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Monitor className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-white font-semibold mb-2">Extension Bulunamadı</h3>
                <p className="text-gray-400 text-sm mb-4">
                  Pezkuwi Wallet veya Polkadot.js extension yüklü değil
                </p>
              </div>

              <a
                href="https://chrome.google.com/webstore/detail/polkadot-js-extension/mopnmbcafieddcagagdcbnhejhlodfdd"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Chrome Web Store&apos;dan Yükle
                </Button>
              </a>

              <Button
                variant="outline"
                className="w-full border-gray-700"
                onClick={() => setConnectionMethod('select')}
              >
                Geri Dön
              </Button>
            </div>
          )}

          {/* WalletConnect State - Desktop QR */}
          {connectionMethod === 'walletconnect' && !mobile && (
            <div className="space-y-4 py-4">
              <div className="text-center">
                <div className="w-48 h-48 mx-auto mb-4 rounded-xl bg-white p-4 flex items-center justify-center">
                  <div className="text-gray-400 text-center">
                    <QrCode className="w-16 h-16 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">QR Kod</p>
                    <p className="text-xs text-gray-500">Yakında</p>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mb-4">
                  Pezkuwi Wallet uygulamasıyla QR kodu tarayın
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full border-gray-700"
                onClick={() => setConnectionMethod('select')}
              >
                Geri Dön
              </Button>
            </div>
          )}

          {/* Account Selection */}
          {showAccountSelect && accounts.length > 0 && (
            <div className="space-y-4 py-4">
              <div className="text-sm text-gray-400 mb-2">Hesap Seçin</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {accounts.map((account) => (
                  <button
                    key={account.address}
                    onClick={() => handleSelectAccount(account)}
                    className="w-full p-4 rounded-lg border border-gray-700 bg-gray-800/50 hover:border-green-500/50 hover:bg-gray-800 transition-all text-left"
                  >
                    <div className="text-white font-medium mb-1">
                      {account.meta.name || 'İsimsiz Hesap'}
                    </div>
                    <div className="text-gray-400 text-sm font-mono">
                      {formatAddress(account.address)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
