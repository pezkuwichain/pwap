import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone, Loader2, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import QRCode from 'qrcode';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useIsMobile } from '@/hooks/use-mobile';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ConnectionState = 'generating' | 'waiting' | 'connected' | 'error';

export const WalletConnectModal: React.FC<WalletConnectModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { connectWalletConnect, selectedAccount, wcPeerName } = usePezkuwi();
  const isMobile = useIsMobile();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [wcUri, setWcUri] = useState<string>('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('generating');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const startConnection = useCallback(async () => {
    setConnectionState('generating');
    setErrorMsg('');

    try {
      const uri = await connectWalletConnect();
      setWcUri(uri);

      if (isMobile) {
        // Mobile: open pezWallet via deep link automatically
        const deepLink = `pezkuwiwallet://wc?uri=${encodeURIComponent(uri)}`;
        window.location.href = deepLink;
        setConnectionState('waiting');
      } else {
        // Desktop: generate QR code
        const dataUrl = await QRCode.toDataURL(uri, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
        setQrDataUrl(dataUrl);
        setConnectionState('waiting');
      }
    } catch (err) {
      setConnectionState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [connectWalletConnect, isMobile]);

  // Start connection when modal opens
  useEffect(() => {
    if (isOpen) {
      startConnection();
    }

    return () => {
      setQrDataUrl('');
      setWcUri('');
      setConnectionState('generating');
    };
  }, [isOpen, startConnection]);

  // Listen for successful connection
  useEffect(() => {
    const handleConnected = () => {
      setConnectionState('connected');
      // Auto-close after brief success display
      setTimeout(() => onClose(), 1500);
    };

    window.addEventListener('walletconnect_connected', handleConnected);
    return () => window.removeEventListener('walletconnect_connected', handleConnected);
  }, [onClose]);

  const handleOpenPezWallet = () => {
    if (wcUri) {
      window.location.href = `pezkuwiwallet://wc?uri=${encodeURIComponent(wcUri)}`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-purple-400" />
            WalletConnect
          </DialogTitle>
          <DialogDescription>
            {isMobile
              ? t('walletModal.wcOpenWallet', 'Connect with pezWallet app')
              : t('walletModal.wcScanQR', 'Scan with pezWallet to connect')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* Generating state */}
          {connectionState === 'generating' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
              <p className="text-sm text-gray-400">
                {t('walletModal.wcGenerating', 'Generating connection...')}
              </p>
            </div>
          )}

          {/* Waiting state */}
          {connectionState === 'waiting' && (
            <>
              {isMobile ? (
                // Mobile: deep link button
                <div className="flex flex-col items-center gap-4 py-4 w-full">
                  <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center">
                    <Smartphone className="h-8 w-8 text-purple-400" />
                  </div>
                  <p className="text-sm text-gray-400 text-center">
                    {t('walletModal.wcWaitingMobile', 'Approve the connection in pezWallet')}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('walletModal.wcWaiting', 'Waiting for wallet to connect...')}
                  </div>
                  <Button
                    onClick={handleOpenPezWallet}
                    className="w-full bg-gradient-to-r from-purple-600 to-cyan-400 hover:from-purple-700 hover:to-cyan-500"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t('walletModal.wcOpenApp', 'Open pezWallet')}
                  </Button>
                  <p className="text-xs text-gray-500 text-center">
                    {t('walletModal.wcInstallHint', "Don't have pezWallet? It will be available on Play Store soon.")}
                  </p>
                </div>
              ) : (
                // Desktop: QR code
                <>
                  {qrDataUrl && (
                    <div className="bg-white rounded-xl p-3">
                      <img
                        src={qrDataUrl}
                        alt="WalletConnect QR Code"
                        className="w-[280px] h-[280px]"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('walletModal.wcWaiting', 'Waiting for wallet to connect...')}
                  </div>
                  <p className="text-xs text-gray-500 text-center max-w-[280px]">
                    {t('walletModal.wcInstructions', 'Open pezWallet app → Settings → WalletConnect → Scan QR code')}
                  </p>
                </>
              )}
            </>
          )}

          {/* Connected state */}
          {connectionState === 'connected' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-lg font-medium text-green-400">
                {t('walletModal.wcConnected', 'Connected!')}
              </p>
              {wcPeerName && (
                <p className="text-sm text-gray-400">{wcPeerName}</p>
              )}
              {selectedAccount && (
                <code className="text-xs text-gray-500 font-mono">
                  {selectedAccount.address.slice(0, 8)}...{selectedAccount.address.slice(-6)}
                </code>
              )}
            </div>
          )}

          {/* Error state */}
          {connectionState === 'error' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <XCircle className="h-12 w-12 text-red-500" />
              <p className="text-sm text-red-400">{errorMsg}</p>
              <Button
                onClick={startConnection}
                variant="outline"
                className="mt-2"
              >
                {t('walletModal.wcRetry', 'Try Again')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
