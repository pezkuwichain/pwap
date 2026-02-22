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
import { useTranslation } from 'react-i18next';

interface InitializeUsdtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type TransactionStatus = 'idle' | 'signing' | 'submitting' | 'success' | 'error';

const USDT_ASSET_ID = 1000; // wUSDT asset ID (matches runtime WUSDT_ASSET_ID)
const USDT_DECIMALS = 6; // USDT standard decimals

export const InitializeUsdtModal: React.FC<InitializeUsdtModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Use Asset Hub API for DEX operations (assets pallet is on Asset Hub)
  const { assetHubApi, isAssetHubReady } = usePezkuwi();
  const { account, signer } = useWallet();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [usdtAmount, setUsdtAmount] = useState('10000');

  const [wusdtBalance, setWusdtBalance] = useState<string>('0');

  const [txStatus, setTxStatus] = useState<TransactionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setUsdtAmount('10000');
      setTxStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen]);

  // Fetch wUSDT balance from Asset Hub
  useEffect(() => {
    const fetchBalance = async () => {
      if (!assetHubApi || !isAssetHubReady || !account) return;

      try {
        // wUSDT balance (asset 1000 on Asset Hub)
        const wusdtData = await assetHubApi.query.assets.account(USDT_ASSET_ID, account);
        setWusdtBalance(wusdtData.isSome ? wusdtData.unwrap().balance.toString() : '0');
      } catch (error) {
        if (import.meta.env.DEV) console.error('Failed to fetch wUSDT balance from Asset Hub:', error);
      }
    };

    fetchBalance();
  }, [assetHubApi, isAssetHubReady, account]);

  const handleMint = async () => {
    if (!assetHubApi || !isAssetHubReady || !signer || !account) {
      toast({
        title: t('common.error'),
        description: t('mint.connectWallet'),
        variant: 'destructive',
      });
      return;
    }

    // Check if assets pallet is available on Asset Hub
    if (!assetHubApi.tx.assets || !assetHubApi.tx.assets.mint) {
      setErrorMessage(t('mint.palletNotAvailable'));
      toast({
        title: t('mint.palletToast'),
        description: t('mint.palletToastDesc'),
        variant: 'destructive',
      });
      return;
    }

    const usdtAmountRaw = BigInt(parseFloat(usdtAmount) * 10 ** USDT_DECIMALS);

    if (usdtAmountRaw <= BigInt(0)) {
      setErrorMessage(t('common.amountGtZero'));
      return;
    }

    setTxStatus('signing');
    setErrorMessage('');

    try {
      if (import.meta.env.DEV) console.log('💵 Minting wUSDT on Asset Hub...', {
        usdtAmount,
        usdtAmountRaw: usdtAmountRaw.toString(),
        assetId: USDT_ASSET_ID,
      });

      const mintTx = assetHubApi.tx.assets.mint(USDT_ASSET_ID, account, usdtAmountRaw.toString());

      setTxStatus('submitting');

      await mintTx.signAndSend(
        account,
        { signer },
        ({ status, dispatchError, events }) => {
          if (import.meta.env.DEV) console.log('📦 Transaction status:', status.type);

          if (status.isInBlock) {
            if (import.meta.env.DEV) console.log('✅ In block:', status.asInBlock.toHex());

            if (dispatchError) {
              let errorMsg = '';

              if (dispatchError.isModule) {
                const decoded = assetHubApi.registry.findMetaError(dispatchError.asModule);
                errorMsg = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
                if (import.meta.env.DEV) console.error('❌ Module error:', errorMsg);
              } else {
                errorMsg = dispatchError.toString();
                if (import.meta.env.DEV) console.error('❌ Dispatch error:', errorMsg);
              }

              setErrorMessage(errorMsg);
              setTxStatus('error');
              toast({
                title: t('common.txFailed'),
                description: errorMsg,
                variant: 'destructive',
              });
            } else {
              if (import.meta.env.DEV) console.log('✅ Mint successful!');
              if (import.meta.env.DEV) console.log('📋 Events:', events.map(e => e.event.method).join(', '));
              setTxStatus('success');
              toast({
                title: t('common.success'),
                description: t('mintUsdt.minted', { amount: usdtAmount }),
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

  const wusdtBalanceDisplay = (parseFloat(wusdtBalance) / 10 ** USDT_DECIMALS).toFixed(2);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="bg-gray-900 border-gray-800 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <CardHeader className="border-b border-gray-800">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-white">
              {t('mintUsdt.title')}
            </CardTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              disabled={txStatus === 'signing' || txStatus === 'submitting'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <Badge className="bg-green-600/20 text-green-400 border-green-600/30 w-fit mt-2">
            {t('mintUsdt.adminOnly')}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Info Banner */}
          <Alert className="bg-green-500/10 border-green-500/30">
            <Info className="h-4 w-4 text-green-400" />
            <AlertDescription className="text-green-300 text-sm">
              {t('mintUsdt.info')}
            </AlertDescription>
          </Alert>

          {/* USDT Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-400">{t('mintUsdt.amount')}</label>
              <span className="text-xs text-gray-500">
                {t('mint.current')} {wusdtBalanceDisplay} wUSDT
              </span>
            </div>
            <div className="relative">
              <Input
                type="number"
                value={usdtAmount}
                onChange={(e) => setUsdtAmount(e.target.value)}
                placeholder="10000"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-lg"
                disabled={txStatus === 'signing' || txStatus === 'submitting'}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                <button
                  onClick={() => setUsdtAmount('10000')}
                  className="px-3 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs rounded border border-green-600/30 transition-colors"
                  disabled={txStatus === 'signing' || txStatus === 'submitting'}
                >
                  10K
                </button>
                <button
                  onClick={() => setUsdtAmount('100000')}
                  className="px-3 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs rounded border border-green-600/30 transition-colors"
                  disabled={txStatus === 'signing' || txStatus === 'submitting'}
                >
                  100K
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {t('mintUsdt.decimalsInfo')}
            </p>
          </div>

          {/* Current wUSDT Balance */}
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">{t('mintUsdt.currentBalance')}</div>
            <div className="text-2xl font-bold text-green-400 font-mono">
              {wusdtBalanceDisplay} wUSDT
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
            <Alert className="bg-green-500/10 border-green-500/30">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-300 text-sm">
                {t('mintUsdt.success', { amount: usdtAmount })}
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
              className="flex-1 bg-green-600 hover:bg-green-700"
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
                  {t('mintUsdt.minting')}
                </>
              )}
              {txStatus === 'idle' && t('mintUsdt.mintBtn')}
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
