import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, CheckCircle, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'qrcode';

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiveModal: React.FC<ReceiveModalProps> = ({ isOpen, onClose }) => {
  const { selectedAccount } = usePezkuwi();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  React.useEffect(() => {
    if (selectedAccount && isOpen) {
      // Generate QR code
      QRCode.toDataURL(selectedAccount.address, {
        width: 300,
        margin: 2,
        color: {
          dark: '#ffffff',
          light: '#0f172a'
        }
      }).then(setQrCodeDataUrl).catch((err) => {
        if (import.meta.env.DEV) console.error('QR code generation failed:', err);
      });
    }
  }, [selectedAccount, isOpen]);

  const handleCopyAddress = async () => {
    if (!selectedAccount) return;

    try {
      await navigator.clipboard.writeText(selectedAccount.address);
      setCopied(true);
      toast({
        title: t('receive.addressCopied'),
        description: t('receive.addressCopiedDesc'),
      });

      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: t('receive.copyFailed'),
        description: t('receive.copyFailedDesc'),
        variant: "destructive",
      });
    }
  };

  if (!selectedAccount) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">{t('receive.title')}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {t('receive.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* QR Code */}
          <div className="bg-white rounded-lg p-4 mx-auto w-fit">
            {qrCodeDataUrl ? (
              <img src={qrCodeDataUrl} alt="QR Code" className="w-64 h-64" />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-gray-200">
                <QrCode className="w-16 h-16 text-gray-400 animate-pulse" />
              </div>
            )}
          </div>

          {/* Account Name */}
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-1">{t('receive.accountName')}</div>
            <div className="text-xl font-semibold text-white">
              {selectedAccount.meta.name || t('receive.unnamed')}
            </div>
          </div>

          {/* Address */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">{t('receive.walletAddress')}</div>
            <div className="bg-gray-900 rounded p-3 mb-3">
              <div className="text-white font-mono text-sm break-all">
                {selectedAccount.address}
              </div>
            </div>

            <Button
              onClick={handleCopyAddress}
              className="w-full bg-gradient-to-r from-green-600 to-yellow-400 hover:from-green-700 hover:to-yellow-500"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {t('receive.copied')}
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  {t('receive.copyAddress')}
                </>
              )}
            </Button>
          </div>

          {/* Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-yellow-400 text-xs">
              {t('receive.warning')}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};