import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { WalletModal } from './wallet/WalletModal';

export const PezkuwiWalletButton: React.FC = () => {
  const {
    selectedAccount,
    disconnectWallet,
  } = usePezkuwi();

  const { t } = useTranslation();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

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

  if (selectedAccount) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30"
          onClick={() => setWalletModalOpen(true)}
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

        <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
      </div>
    );
  }

  return (
    <>
      <Button
        onClick={() => setWalletModalOpen(true)}
        className="bg-gradient-to-r from-green-600 to-yellow-400 hover:from-green-700 hover:to-yellow-500 text-white"
        size={isMobile ? "icon" : "default"}
      >
        <Wallet className={isMobile ? "w-4 h-4" : "w-4 h-4 mr-2"} />
        {!isMobile && t('pezWallet.connect')}
      </Button>

      <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </>
  );
};