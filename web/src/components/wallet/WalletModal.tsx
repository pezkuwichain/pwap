import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, Chrome, ExternalLink, Copy, Check, LogOut, Award, Users, TrendingUp, Shield, Smartphone, Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { formatAddress } from '@pezkuwi/lib/wallet';
import { getAllScores, type UserScores } from '@pezkuwi/lib/scores';
import { WalletConnectModal } from './WalletConnectModal';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const {
    accounts,
    selectedAccount,
    setSelectedAccount,
    connectWallet,
    disconnectWallet,
    api,
    isApiReady,
    isApiInitializing,
    peopleApi,
    walletSource,
    wcPeerName,
    error
  } = usePezkuwi();

  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);
  const [showWCModal, setShowWCModal] = useState(false);
  const [scores, setScores] = useState<UserScores>({
    trustScore: 0,
    referralScore: 0,
    stakingScore: 0,
    tikiScore: 0,
    totalScore: 0
  });
  const [loadingScores, setLoadingScores] = useState(false);

  const handleCopyAddress = () => {
    if (selectedAccount?.address) {
      navigator.clipboard.writeText(selectedAccount.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnect = async () => {
    await connectWallet();
  };

  const handleSelectAccount = (account: typeof accounts[0]) => {
    setSelectedAccount(account);
    onClose();
  };

  const handleDisconnect = () => {
    disconnectWallet();
    onClose();
  };

  // Fetch all scores from blockchain
  useEffect(() => {
    const fetchAllScores = async () => {
      if (!api || !isApiReady || !selectedAccount?.address) {
        setScores({
          trustScore: 0,
          referralScore: 0,
          stakingScore: 0,
          tikiScore: 0,
          totalScore: 0
        });
        return;
      }

      setLoadingScores(true);
      try {
        const userScores = await getAllScores(peopleApi || null, selectedAccount.address);
        setScores(userScores);
      } catch (err) {
        if (import.meta.env.DEV) console.error('Failed to fetch scores:', err);
        setScores({
          trustScore: 0,
          referralScore: 0,
          stakingScore: 0,
          tikiScore: 0,
          totalScore: 0
        });
      } finally {
        setLoadingScores(false);
      }
    };

    fetchAllScores();
  }, [api, isApiReady, peopleApi, selectedAccount]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-purple-400" />
            {selectedAccount ? t('walletModal.connected') : t('walletModal.connect')}
          </DialogTitle>
          <DialogDescription>
            {selectedAccount
              ? t('walletModal.manageAccount')
              : t('walletModal.connectDesc')}
          </DialogDescription>
        </DialogHeader>

        {/* Authorization Error - Extension installed but not authorized */}
        {error && error.includes('authorize') && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-300">
                {error}
              </p>
            </div>

            <Button
              onClick={handleConnect}
              className="w-full bg-gradient-to-r from-purple-600 to-cyan-400 hover:from-purple-700 hover:to-cyan-500"
            >
              <Wallet className="mr-2 h-4 w-4" />
              {t('walletModal.tryAgain')}
            </Button>
          </div>
        )}

        {/* No Extension Error - Extension not installed */}
        {error && error.includes('not found') && (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-sm text-yellow-300">
                {error}
              </p>
            </div>

            <div className="flex gap-3">
              <a
                href="https://chromewebstore.google.com/search/pezkuwi%7B.js%7D%20extension?hl=en-GB&utm_source=ext_sidebar"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  <Chrome className="mr-2 h-4 w-4" />
                  {t('walletModal.installChrome')}
                </Button>
              </a>
            </div>

            <p className="text-xs text-gray-400 text-center">
              {t('walletModal.afterInstall')}
            </p>
          </div>
        )}

        {/* Connected State */}
        {selectedAccount && !error && (
          <div className="space-y-4">
            {/* Account Info */}
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
              <div>
                <div className="text-xs text-gray-400 mb-1">{t('walletModal.accountName')}</div>
                <div className="font-medium">{selectedAccount.meta.name || t('walletModal.unnamed')}</div>
              </div>

              <div>
                <div className="text-xs text-gray-400 mb-1">{t('walletModal.address')}</div>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-sm font-mono text-gray-300 truncate">
                    {formatAddress(selectedAccount.address)}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleCopyAddress}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-400 mb-2">{t('walletModal.scoresFromBlockchain')}</div>
                {loadingScores ? (
                  <div className="text-sm text-gray-400">{t('walletModal.loadingScores')}</div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-900/50 rounded p-2">
                      <div className="flex items-center gap-1 mb-1">
                        <Shield className="h-3 w-3 text-purple-400" />
                        <span className="text-xs text-gray-400">{t('walletModal.trust')}</span>
                      </div>
                      <span className="text-sm font-bold text-purple-400">{scores.trustScore}</span>
                    </div>
                    <div className="bg-gray-900/50 rounded p-2">
                      <div className="flex items-center gap-1 mb-1">
                        <Users className="h-3 w-3 text-cyan-400" />
                        <span className="text-xs text-gray-400">{t('walletModal.referral')}</span>
                      </div>
                      <span className="text-sm font-bold text-cyan-400">{scores.referralScore}</span>
                    </div>
                    <div className="bg-gray-900/50 rounded p-2">
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingUp className="h-3 w-3 text-green-400" />
                        <span className="text-xs text-gray-400">{t('walletModal.staking')}</span>
                      </div>
                      <span className="text-sm font-bold text-green-400">{scores.stakingScore}</span>
                    </div>
                    <div className="bg-gray-900/50 rounded p-2">
                      <div className="flex items-center gap-1 mb-1">
                        <Award className="h-3 w-3 text-pink-400" />
                        <span className="text-xs text-gray-400">{t('walletModal.tiki')}</span>
                      </div>
                      <span className="text-sm font-bold text-pink-400">{scores.tikiScore}</span>
                    </div>
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{t('walletModal.totalScore')}</span>
                    <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                      {loadingScores ? '...' : scores.totalScore}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-400 mb-1">{t('walletModal.source')}</div>
                <div className="text-sm text-gray-300 flex items-center gap-2">
                  {walletSource === 'walletconnect' ? (
                    <>
                      <Smartphone className="h-3 w-3 text-purple-400" />
                      WalletConnect{wcPeerName ? ` (${wcPeerName})` : ''}
                    </>
                  ) : (
                    selectedAccount.meta.source || 'pezkuwi'
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(`https://pezkuwichain.io/explorer`, '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {t('walletModal.viewOnExplorer')}
              </Button>
              <Button
                variant="outline"
                onClick={handleDisconnect}
                className="text-red-400 border-red-400/30 hover:bg-red-400/10"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t('walletModal.disconnect')}
              </Button>
            </div>

            {/* Switch Account */}
            {accounts.length > 1 && (
              <div className="space-y-2">
                <div className="text-sm text-gray-400">{t('walletModal.switchAccount')}</div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {accounts.map((account) => (
                    <button
                      key={account.address}
                      onClick={() => handleSelectAccount(account)}
                      className={`w-full p-3 rounded-lg border transition-all text-left ${
                        account.address === selectedAccount.address
                          ? 'bg-purple-500/20 border-purple-500/50'
                          : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="font-medium text-sm">
                        {account.meta.name || t('walletModal.unnamed')}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">
                        {formatAddress(account.address)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Not Connected State */}
        {!selectedAccount && !error && (
          <div className="space-y-4">
            {accounts.length > 0 ? (
              // Has accounts, show selection
              <div className="space-y-2">
                <div className="text-sm text-gray-400">{t('walletModal.selectAccount')}</div>
                <div className="space-y-2">
                  {accounts.map((account) => (
                    <button
                      key={account.address}
                      onClick={() => handleSelectAccount(account)}
                      className="w-full p-4 rounded-lg border border-gray-700 bg-gray-800/50 hover:border-purple-500/50 hover:bg-gray-800 transition-all text-left"
                    >
                      <div className="font-medium mb-1">
                        {account.meta.name || t('walletModal.unnamed')}
                      </div>
                      <div className="text-sm text-gray-400 font-mono">
                        {account.address}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // No accounts — mobile: only mobile wallet, desktop: both options
              <div className="space-y-3">
                {/* Option 1: Browser Extension (desktop only) */}
                {!isMobile && (
                <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Chrome className="h-5 w-5 text-green-400" />
                    <div>
                      <div className="font-medium text-sm">{t('walletModal.extensionTitle')}</div>
                      <div className="text-xs text-gray-400">{t('walletModal.extensionDesc')}</div>
                    </div>
                  </div>
                  <Button
                    onClick={handleConnect}
                    className="w-full bg-gradient-to-r from-purple-600 to-cyan-400 hover:from-purple-700 hover:to-cyan-500"
                    size="sm"
                    disabled={isApiInitializing}
                  >
                    {isApiInitializing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('walletModal.connectingBlockchain', 'Connecting to blockchain...')}
                      </>
                    ) : (
                      <>
                        <Wallet className="mr-2 h-4 w-4" />
                        {t('walletModal.extensionConnect')}
                      </>
                    )}
                  </Button>
                  <a
                    href="https://chromewebstore.google.com/search/pezkuwi%7B.js%7D%20extension?hl=en-GB&utm_source=ext_sidebar"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-purple-400 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {t('walletModal.extensionGet')}
                  </a>
                </div>
                )}

                {/* Option 2: Mobile Wallet */}
                <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-purple-400" />
                    <div>
                      <div className="font-medium text-sm">{t('walletModal.mobileTitle')}</div>
                      <div className="text-xs text-gray-400">{t('walletModal.mobileDesc')}</div>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowWCModal(true)}
                    variant="outline"
                    className="w-full border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-500/10"
                    size="sm"
                    disabled={isApiInitializing}
                  >
                    {isApiInitializing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('walletModal.connectingBlockchain', 'Connecting to blockchain...')}
                      </>
                    ) : (
                      <>
                        <Smartphone className="mr-2 h-4 w-4" />
                        {t('walletModal.mobileConnect')}
                      </>
                    )}
                  </Button>
                  <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
                    {t('walletModal.mobileComingSoon')}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>

      {/* WalletConnect QR Modal */}
      <WalletConnectModal
        isOpen={showWCModal}
        onClose={() => {
          setShowWCModal(false);
          // If connected via WC, close the main modal too
          if (selectedAccount) onClose();
        }}
      />
    </Dialog>
  );
};