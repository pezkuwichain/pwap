import React, { useState, useEffect } from 'react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useWallet } from '@/contexts/WalletContext';
import { X, AlertCircle, Loader2, CheckCircle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import type { AssetConfig } from './mintableAssets';
import { useTranslation } from 'react-i18next';

interface MintAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  asset: AssetConfig;
}

type TransactionStatus = 'idle' | 'signing' | 'submitting' | 'success' | 'error';

export const MintAssetModal: React.FC<MintAssetModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  asset,
}) => {
  const { assetHubApi, isAssetHubReady } = usePezkuwi();
  const { account, signer } = useWallet();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [amount, setAmount] = useState(asset.defaultAmount || '1000');
  const [balance, setBalance] = useState<string>('0');
  const [txStatus, setTxStatus] = useState<TransactionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Color schemes
  const colorSchemes: Record<string, { bg: string; border: string; text: string; button: string; buttonHover: string }> = {
    green: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', button: 'bg-green-600', buttonHover: 'hover:bg-green-700' },
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', button: 'bg-blue-600', buttonHover: 'hover:bg-blue-700' },
    orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', button: 'bg-orange-600', buttonHover: 'hover:bg-orange-700' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', button: 'bg-purple-600', buttonHover: 'hover:bg-purple-700' },
    pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400', button: 'bg-pink-600', buttonHover: 'hover:bg-pink-700' },
  };

  const colors = colorSchemes[asset.color || 'green'];

  // Reset form when modal closes or asset changes
  useEffect(() => {
    if (!isOpen) {
      setAmount(asset.defaultAmount || '1000');
      setTxStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen, asset]);

  // Fetch balance from Asset Hub
  useEffect(() => {
    const fetchBalance = async () => {
      if (!assetHubApi || !isAssetHubReady || !account) return;

      try {
        const assetData = await assetHubApi.query.assets.account(asset.id, account);
        setBalance(assetData.isSome ? assetData.unwrap().balance.toString() : '0');
      } catch (error) {
        if (import.meta.env.DEV) console.error(`Failed to fetch ${asset.symbol} balance:`, error);
      }
    };

    fetchBalance();
  }, [assetHubApi, isAssetHubReady, account, asset.id, asset.symbol]);

  const handleMint = async () => {
    if (!assetHubApi || !isAssetHubReady || !signer || !account) {
      toast({
        title: t('common.error'),
        description: t('mint.connectWallet'),
        variant: 'destructive',
      });
      return;
    }

    if (!assetHubApi.tx.assets || !assetHubApi.tx.assets.mint) {
      setErrorMessage(t('mint.palletNotAvailable'));
      toast({
        title: t('mint.palletToast'),
        description: t('mint.palletToastDesc'),
        variant: 'destructive',
      });
      return;
    }

    const amountRaw = BigInt(Math.floor(parseFloat(amount) * 10 ** asset.decimals));

    if (amountRaw <= BigInt(0)) {
      setErrorMessage(t('common.amountGtZero'));
      return;
    }

    setTxStatus('signing');
    setErrorMessage('');

    try {
      if (import.meta.env.DEV) console.log(`Minting ${asset.symbol} on Asset Hub...`, {
        amount,
        amountRaw: amountRaw.toString(),
        assetId: asset.id,
      });

      const mintTx = assetHubApi.tx.assets.mint(asset.id, account, amountRaw.toString());

      setTxStatus('submitting');

      await mintTx.signAndSend(
        account,
        { signer },
        ({ status, dispatchError }) => {
          if (import.meta.env.DEV) console.log('Transaction status:', status.type);

          if (status.isInBlock) {
            if (import.meta.env.DEV) console.log('In block:', status.asInBlock.toHex());

            if (dispatchError) {
              let errorMsg = '';

              if (dispatchError.isModule) {
                const decoded = assetHubApi.registry.findMetaError(dispatchError.asModule);
                errorMsg = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
                if (import.meta.env.DEV) console.error('Module error:', errorMsg);
              } else {
                errorMsg = dispatchError.toString();
                if (import.meta.env.DEV) console.error('Dispatch error:', errorMsg);
              }

              setErrorMessage(errorMsg);
              setTxStatus('error');
              toast({
                title: t('common.txFailed'),
                description: errorMsg,
                variant: 'destructive',
              });
            } else {
              if (import.meta.env.DEV) console.log('Mint successful!');
              setTxStatus('success');
              toast({
                title: t('common.success'),
                description: t('mint.minted', { amount, symbol: asset.symbol }),
              });
              setTimeout(() => {
                onSuccess?.();
                onClose();
              }, 2000);
            }
          }
        }
      );
    } catch (error) {
      if (import.meta.env.DEV) console.error('Mint failed:', error);
      setErrorMessage(error instanceof Error ? error.message : t('common.txFailed'));
      setTxStatus('error');
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('common.txFailed'),
        variant: 'destructive',
      });
    }
  };

  if (!isOpen) return null;

  const balanceDisplay = (parseFloat(balance) / 10 ** asset.decimals).toFixed(asset.decimals > 6 ? 6 : 2);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="bg-gray-900 border-gray-800 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <CardHeader className="border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {asset.logo && (
                <img src={asset.logo} alt={asset.symbol} className="w-8 h-8 rounded-full" />
              )}
              <CardTitle className="text-xl font-bold text-white">
                {t('mint.title', { symbol: asset.symbol })}
              </CardTitle>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              disabled={txStatus === 'signing' || txStatus === 'submitting'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <Badge className={`${colors.bg} ${colors.text} ${colors.border} w-fit mt-2`}>
            {t('mint.adminOnly')}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Info Banner */}
          <Alert className={`${colors.bg} ${colors.border}`}>
            <Info className={`h-4 w-4 ${colors.text}`} />
            <AlertDescription className={`${colors.text.replace('400', '300')} text-sm`}>
              {t('mint.info', { name: asset.name })}
            </AlertDescription>
          </Alert>

          {/* Amount Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-400">{t('mint.amount', { symbol: asset.symbol })}</label>
              <span className="text-xs text-gray-500">
                {t('mint.current')}: {balanceDisplay} {asset.symbol}
              </span>
            </div>
            <div className="relative">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-lg"
                disabled={txStatus === 'signing' || txStatus === 'submitting'}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                <button
                  onClick={() => setAmount('1000')}
                  className={`px-3 py-1 ${colors.bg} hover:opacity-80 ${colors.text} text-xs rounded ${colors.border} transition-colors`}
                  disabled={txStatus === 'signing' || txStatus === 'submitting'}
                >
                  1K
                </button>
                <button
                  onClick={() => setAmount('10000')}
                  className={`px-3 py-1 ${colors.bg} hover:opacity-80 ${colors.text} text-xs rounded ${colors.border} transition-colors`}
                  disabled={txStatus === 'signing' || txStatus === 'submitting'}
                >
                  10K
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {t('mint.decimalsInfo', { symbol: asset.symbol, decimals: asset.decimals })}
            </p>
          </div>

          {/* Current Balance */}
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">{t('mint.currentBalance', { symbol: asset.symbol })}</div>
            <div className={`text-2xl font-bold ${colors.text} font-mono`}>
              {balanceDisplay} {asset.symbol}
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <Alert className="bg-red-500/10 border-red-500/30">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300 text-sm">
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {txStatus === 'success' && (
            <Alert className={`${colors.bg} ${colors.border}`}>
              <CheckCircle className={`h-4 w-4 ${colors.text}`} />
              <AlertDescription className={`${colors.text.replace('400', '300')} text-sm`}>
                {t('mint.success', { amount, symbol: asset.symbol })}
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 border-gray-700 hover:bg-gray-800"
              disabled={txStatus === 'signing' || txStatus === 'submitting'}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleMint}
              className={`flex-1 ${colors.button} ${colors.buttonHover}`}
              disabled={
                txStatus === 'signing' ||
                txStatus === 'submitting' ||
                txStatus === 'success'
              }
            >
              {txStatus === 'signing' && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {t('common.signing')}
                </>
              )}
              {txStatus === 'submitting' && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {t('mint.minting')}
                </>
              )}
              {txStatus === 'idle' && t('mint.mintBtn', { symbol: asset.symbol })}
              {txStatus === 'error' && t('common.retry')}
              {txStatus === 'success' && (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {t('common.success')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
