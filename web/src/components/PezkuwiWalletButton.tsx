import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Wallet, Check, ExternalLink, Copy, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

export const PezkuwiWalletButton: React.FC = () => {
  const {
    accounts,
    selectedAccount,
    setSelectedAccount,
    connectWallet,
    disconnectWallet,
    error
  } = usePezkuwi();

  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const handleConnect = async () => {
    await connectWallet();
    if (accounts.length > 0) {
      setIsOpen(true);
    }
  };

  const handleSelectAccount = (account: typeof accounts[0]) => {
    setSelectedAccount(account);
    setIsOpen(false);
    toast({
      title: t('pezWallet.connected'),
      description: `${account.meta.name} - ${formatAddress(account.address)}`,
    });
  };

  const handleDisconnect = () => {
    disconnectWallet();
    toast({
      title: t('pezWallet.disconnected'),
      description: t('pezWallet.disconnectedDesc'),
    });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyAddress = () => {
    if (selectedAccount) {
      navigator.clipboard.writeText(selectedAccount.address);
      toast({
        title: t('pezWallet.addressCopied'),
        description: t('pezWallet.addressCopiedDesc'),
      });
    }
  };

  if (selectedAccount) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30"
          onClick={() => setIsOpen(true)}
          size={isMobile ? "icon" : "default"}
        >
          <Wallet className={isMobile ? "w-4 h-4" : "w-4 h-4 mr-2"} />
          {!isMobile && (
            <>
              {selectedAccount.meta.name || 'Account'}
              <Badge className="ml-2 bg-green-500/30 text-green-300 border-0">
                {formatAddress(selectedAccount.address)}
              </Badge>
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDisconnect}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <LogOut className="w-4 h-4" />
        </Button>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="bg-gray-900 border-gray-800">
            <DialogHeader>
              <DialogTitle className="text-white">{t('pezWallet.accountDetails')}</DialogTitle>
              <DialogDescription className="text-gray-400">
                {t('pezWallet.accountDetailsDesc')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">{t('pezWallet.accountName')}</div>
                <div className="text-white font-medium">
                  {selectedAccount.meta.name || t('pezWallet.unnamed')}
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">{t('pezWallet.address')}</div>
                <div className="flex items-center justify-between">
                  <code className="text-white text-sm font-mono">
                    {selectedAccount.address}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyAddress}
                    className="text-gray-400 hover:text-white"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">{t('pezWallet.source')}</div>
                <div className="text-white">
                  {selectedAccount.meta.source || 'pezkuwi'}
                </div>
              </div>

              {accounts.length > 1 && (
                <div>
                  <div className="text-sm text-gray-400 mb-2">{t('pezWallet.switchAccount')}</div>
                  <div className="space-y-2">
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
                            {account.meta.name || t('pezWallet.unnamed')}
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

  return (
    <>
      <Button
        onClick={handleConnect}
        className="bg-gradient-to-r from-green-600 to-yellow-400 hover:from-green-700 hover:to-yellow-500 text-white"
        size={isMobile ? "icon" : "default"}
      >
        <Wallet className={isMobile ? "w-4 h-4" : "w-4 h-4 mr-2"} />
        {!isMobile && t('pezWallet.connect')}
      </Button>

      {error && error.includes('not found') && (
        <Dialog open={!!error} onOpenChange={() => {}}>
          <DialogContent className="bg-gray-900 border-gray-800">
            <DialogHeader>
              <DialogTitle className="text-white">{t('pezWallet.installTitle')}</DialogTitle>
              <DialogDescription className="text-gray-400">
                {t('pezWallet.installDesc')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-gray-300">
                {t('pezWallet.installText')}
              </p>

              <div className="flex gap-3">
                <a
                  href="https://chromewebstore.google.com/search/pezkuwi%7B.js%7D%20extension?hl=en-GB&utm_source=ext_sidebar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {t('pezWallet.installChrome')}
                  </Button>
                </a>
              </div>

              <p className="text-xs text-gray-500">
                {t('pezWallet.installRefresh')}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={isOpen && accounts.length > 0} onOpenChange={setIsOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">{t('pezWallet.selectTitle')}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {t('pezWallet.selectDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {accounts.map((account) => (
              <button
                key={account.address}
                onClick={() => handleSelectAccount(account)}
                className="w-full p-4 rounded-lg border border-gray-700 bg-gray-800/50 hover:border-green-500/50 hover:bg-gray-800 transition-all text-left"
              >
                <div className="text-white font-medium mb-1">
                  {account.meta.name || t('pezWallet.unnamed')}
                </div>
                <div className="text-gray-400 text-sm font-mono">
                  {account.address}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};