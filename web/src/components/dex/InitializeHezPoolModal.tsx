import React, { useState, useEffect } from 'react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useWallet } from '@/contexts/WalletContext';
import { X, AlertCircle, Loader2, CheckCircle, Info, ArrowDownUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface InitializeHezPoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type TransactionStatus = 'idle' | 'signing' | 'submitting' | 'success' | 'error';
type WrapMode = 'wrap' | 'unwrap';

export const InitializeHezPoolModal: React.FC<InitializeHezPoolModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Use Asset Hub API for DEX operations (tokenWrapper pallet is on Asset Hub)
  const { assetHubApi, isAssetHubReady } = usePezkuwi();
  const { account, signer } = useWallet();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [mode, setMode] = useState<WrapMode>('wrap');
  const [amount, setAmount] = useState('10000');

  const [hezBalance, setHezBalance] = useState<string>('0');
  const [whezBalance, setWhezBalance] = useState<string>('0');
  const [palletAvailable, setPalletAvailable] = useState<boolean | null>(null);

  const [txStatus, setTxStatus] = useState<TransactionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Reset form when modal closes or mode changes
  useEffect(() => {
    if (!isOpen) {
      setAmount('10000');
      setTxStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen]);

  useEffect(() => {
    setTxStatus('idle');
    setErrorMessage('');
  }, [mode]);

  // Check if tokenWrapper pallet is available on Asset Hub
  useEffect(() => {
    const checkPallet = async () => {
      if (!assetHubApi || !isAssetHubReady) {
        setPalletAvailable(null);
        return;
      }

      try {
        // Check if tokenWrapper pallet exists on Asset Hub
        const hasTokenWrapper = assetHubApi.tx.tokenWrapper !== undefined &&
                                assetHubApi.tx.tokenWrapper.wrap !== undefined &&
                                assetHubApi.tx.tokenWrapper.unwrap !== undefined;
        setPalletAvailable(hasTokenWrapper);

        if (import.meta.env.DEV) {
          console.log('🔍 TokenWrapper pallet on Asset Hub:', hasTokenWrapper);
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error('Failed to check pallet:', error);
        setPalletAvailable(false);
      }
    };

    checkPallet();
  }, [assetHubApi, isAssetHubReady]);

  // Fetch balances from Asset Hub
  useEffect(() => {
    const fetchBalances = async () => {
      if (!assetHubApi || !isAssetHubReady || !account) return;

      try {
        // HEZ balance (native on Asset Hub)
        const balance = await assetHubApi.query.system.account(account);
        const freeBalance = (balance as { data: { free: { toString: () => string } } }).data.free.toString();
        setHezBalance(freeBalance);

        // wHEZ balance (asset 2 on Asset Hub - tokenWrapper creates asset 2)
        const whezData = await assetHubApi.query.assets.account(2, account);
        const whezTyped = whezData as { isSome: boolean; unwrap: () => { balance: { toString: () => string } } };
        setWhezBalance(whezTyped.isSome ? whezTyped.unwrap().balance.toString() : '0');
      } catch (error) {
        if (import.meta.env.DEV) console.error('Failed to fetch balances from Asset Hub:', error);
      }
    };

    fetchBalances();

    // Refetch after successful transaction
    if (txStatus === 'success') {
      const timer = setTimeout(fetchBalances, 2000);
      return () => clearTimeout(timer);
    }
  }, [assetHubApi, isAssetHubReady, account, txStatus]);

  const handleTransaction = async () => {
    if (!assetHubApi || !isAssetHubReady || !signer || !account) {
      toast({
        title: t('common.error'),
        description: t('mint.connectWallet'),
        variant: 'destructive',
      });
      return;
    }

    if (!palletAvailable) {
      setErrorMessage(t('tokenWrapping.palletNotAvailable'));
      toast({
        title: t('mint.palletToast'),
        description: t('tokenWrapping.palletNotAvailable'),
        variant: 'destructive',
      });
      return;
    }

    const amountRaw = BigInt(parseFloat(amount) * 10 ** 12);

    if (amountRaw <= BigInt(0)) {
      setErrorMessage(t('common.amountGtZero'));
      return;
    }

    const sourceBalance = mode === 'wrap' ? hezBalance : whezBalance;
    if (amountRaw > BigInt(sourceBalance)) {
      setErrorMessage(t('common.insufficientBalance', { symbol: mode === 'wrap' ? 'HEZ' : 'wHEZ' }));
      return;
    }

    setTxStatus('signing');
    setErrorMessage('');

    try {
      const isWrap = mode === 'wrap';
      if (import.meta.env.DEV) {
        console.log(`🔄 ${isWrap ? 'Wrapping' : 'Unwrapping'} on Asset Hub...`, {
          amount,
          amountRaw: amountRaw.toString(),
        });
      }

      const tx = isWrap
        ? assetHubApi.tx.tokenWrapper.wrap(amountRaw.toString())
        : assetHubApi.tx.tokenWrapper.unwrap(amountRaw.toString());

      setTxStatus('submitting');

      await tx.signAndSend(
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
              if (import.meta.env.DEV) console.log(`✅ ${isWrap ? 'Wrap' : 'Unwrap'} successful!`);
              if (import.meta.env.DEV) console.log('📋 Events:', events.map(e => e.event.method).join(', '));
              setTxStatus('success');
              toast({
                title: t('common.success'),
                description: isWrap
                  ? t('tokenWrapping.wrapSuccess', { amount })
                  : t('tokenWrapping.unwrapSuccess', { amount }),
              });
              onSuccess?.();
            }
          }
        }
      );
    } catch (error) {
      if (import.meta.env.DEV) console.error('Transaction failed:', error);
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

  const hezBalanceDisplay = (parseFloat(hezBalance) / 10 ** 12).toLocaleString(undefined, { maximumFractionDigits: 4 });
  const whezBalanceDisplay = (parseFloat(whezBalance) / 10 ** 12).toLocaleString(undefined, { maximumFractionDigits: 4 });

  const sourceToken = mode === 'wrap' ? 'HEZ' : 'wHEZ';
  const targetToken = mode === 'wrap' ? 'wHEZ' : 'HEZ';
  const sourceBalance = mode === 'wrap' ? hezBalanceDisplay : whezBalanceDisplay;
  const sourceBalanceRaw = mode === 'wrap' ? hezBalance : whezBalance;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="bg-gray-900 border-gray-800 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <CardHeader className="border-b border-gray-800">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <ArrowDownUp className="w-5 h-5" />
              {t('tokenWrapping.title')}
            </CardTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              disabled={txStatus === 'signing' || txStatus === 'submitting'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30 w-fit mt-2">
            {t('tokenWrapping.adminOnly')}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Pallet Availability Warning */}
          {palletAvailable === false && (
            <Alert className="bg-yellow-500/10 border-yellow-500/30">
              <AlertCircle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-300 text-sm">
                <strong>{t('tokenWrapping.palletNotDeployed')}</strong> {t('tokenWrapping.contactDev')}
              </AlertDescription>
            </Alert>
          )}

          {/* Tabs for Wrap / Unwrap */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as WrapMode)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-800">
              <TabsTrigger value="wrap" className="data-[state=active]:bg-blue-600">
                HEZ → wHEZ
              </TabsTrigger>
              <TabsTrigger value="unwrap" className="data-[state=active]:bg-green-600">
                wHEZ → HEZ
              </TabsTrigger>
            </TabsList>

            <TabsContent value="wrap" className="mt-4">
              <Alert className="bg-blue-500/10 border-blue-500/30">
                <Info className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-blue-300 text-sm">
                  {t('tokenWrapping.wrapInfo')}
                </AlertDescription>
              </Alert>
            </TabsContent>

            <TabsContent value="unwrap" className="mt-4">
              <Alert className="bg-green-500/10 border-green-500/30">
                <Info className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-300 text-sm">
                  {t('tokenWrapping.unwrapInfo')}
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>

          {/* Balances Display */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg border ${mode === 'wrap' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-gray-800/50 border-gray-700'}`}>
              <div className="text-sm text-gray-400 mb-1">{t('tokenWrapping.nativeHez')}</div>
              <div className="text-xl font-bold text-blue-400 font-mono">
                {hezBalanceDisplay}
              </div>
            </div>
            <div className={`p-4 rounded-lg border ${mode === 'unwrap' ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-800/50 border-gray-700'}`}>
              <div className="text-sm text-gray-400 mb-1">{t('tokenWrapping.wrappedWhez')}</div>
              <div className="text-xl font-bold text-cyan-400 font-mono">
                {whezBalanceDisplay}
              </div>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-400">{t('tokenWrapping.amount', { token: sourceToken })}</label>
              <span className="text-xs text-gray-500">
                {t('tokenWrapping.available')} {sourceBalance} {sourceToken}
              </span>
            </div>
            <div className="relative">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-lg"
                disabled={txStatus === 'signing' || txStatus === 'submitting'}
              />
              <button
                onClick={() => setAmount((parseFloat(sourceBalanceRaw) / 10 ** 12).toFixed(4))}
                className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs rounded border border-green-600/30 transition-colors"
                disabled={txStatus === 'signing' || txStatus === 'submitting'}
              >
                {t('common.max')}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {t('tokenWrapping.receiveInfo', { amount, token: targetToken })}
            </p>
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
                {mode === 'wrap' ? t('tokenWrapping.wrapSuccess', { amount }) : t('tokenWrapping.unwrapSuccess', { amount })}
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
              onClick={handleTransaction}
              className={`flex-1 ${mode === 'wrap' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
              disabled={
                txStatus === 'signing' ||
                txStatus === 'submitting' ||
                palletAvailable === false
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
                  {mode === 'wrap' ? t('tokenWrapping.wrapping') : t('tokenWrapping.unwrapping')}
                </>
              )}
              {txStatus === 'idle' && (mode === 'wrap' ? t('tokenWrapping.wrapBtn') : t('tokenWrapping.unwrapBtn'))}
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
