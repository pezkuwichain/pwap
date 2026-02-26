import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Wallet
} from 'lucide-react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useWallet } from '@/contexts/WalletContext';
import { useP2PIdentity } from '@/contexts/P2PIdentityContext';
import { toast } from 'sonner';

import {
  getPlatformWalletAddress,
  type CryptoToken
} from '@shared/lib/p2p-fiat';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type DepositStep = 'select' | 'send' | 'verifying' | 'success';

export function DepositModal({ isOpen, onClose, onSuccess }: DepositModalProps) {
  const { t } = useTranslation();
  const { assetHubApi, isAssetHubReady, selectedAccount } = usePezkuwi();
  const { balances, signTransaction } = useWallet();
  const { identityId } = useP2PIdentity();

  const [step, setStep] = useState<DepositStep>('select');
  const [token, setToken] = useState<CryptoToken>('HEZ');
  const [amount, setAmount] = useState('');
  const [platformWallet, setPlatformWallet] = useState<string>('');
  const [txHash, setTxHash] = useState('');
  const [blockNumber, setBlockNumber] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // Fetch platform wallet address on mount
  useEffect(() => {
    if (isOpen) {
      fetchPlatformWallet();
    }
  }, [isOpen]);

  const fetchPlatformWallet = async () => {
    const address = await getPlatformWalletAddress();
    setPlatformWallet(address);
  };

  const resetModal = () => {
    setStep('select');
    setToken('HEZ');
    setAmount('');
    setTxHash('');
    setBlockNumber(undefined);
    setLoading(false);
    setCopied(false);
    setVerifyError('');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(platformWallet);
      setCopied(true);
      toast.success(t('p2pDeposit.addressCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('p2pDeposit.failedToCopy'));
    }
  };

  const getAvailableBalance = () => {
    if (token === 'HEZ') return balances.HEZ;
    if (token === 'PEZ') return balances.PEZ;
    return '0';
  };

  const handleSendDeposit = async () => {
    if (!assetHubApi || !isAssetHubReady || !selectedAccount) {
      toast.error(t('p2pDeposit.connectWallet'));
      return;
    }

    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      toast.error(t('p2pDeposit.enterValidAmount'));
      return;
    }

    setLoading(true);

    try {
      // Build the transfer transaction
      const DECIMALS = 12;
      const amountBN = BigInt(Math.floor(depositAmount * 10 ** DECIMALS));

      let tx;
      if (token === 'HEZ') {
        // Native transfer on Asset Hub
        tx = assetHubApi.tx.balances.transferKeepAlive(platformWallet, amountBN);
      } else {
        // Asset transfer (PEZ = asset ID 1)
        const assetId = token === 'PEZ' ? 1 : 0;
        tx = assetHubApi.tx.assets.transfer(assetId, platformWallet, amountBN);
      }

      toast.info(t('p2pDeposit.signTransaction'));

      // Sign and send
      const hash = await signTransaction(tx);

      if (hash) {
        setTxHash(hash);
        // Capture approximate block number for faster verification
        let blockNum: number | undefined;
        try {
          const header = await assetHubApi.rpc.chain.getHeader();
          blockNum = header.number.toNumber();
          setBlockNumber(blockNum);
        } catch {
          // Non-critical - verification will still work via search
        }
        setStep('verifying');
        toast.success(t('p2pDeposit.txSent'));
        // Wait for TX to be included in a block before verifying (~12s block time)
        setTimeout(() => handleVerifyDeposit(hash, blockNum), 12000);
      }
    } catch (error: unknown) {
      console.error('Deposit transaction error:', error);
      const message = error instanceof Error ? error.message : t('p2pDeposit.txFailed');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDeposit = async (hash?: string, blockNum?: number) => {
    const verifyHash = hash || txHash;
    const verifyBlockNumber = blockNum !== undefined ? blockNum : blockNumber;

    if (!verifyHash) {
      toast.error(t('p2pDeposit.enterTxHash'));
      return;
    }

    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      toast.error(t('p2pDeposit.invalidAmount'));
      return;
    }

    setVerifyError('');
    setStep('verifying');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/verify-deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          txHash: verifyHash,
          token,
          expectedAmount: depositAmount,
          walletAddress: selectedAccount?.address,
          identityId,
          ...(verifyBlockNumber ? { blockNumber: verifyBlockNumber } : {})
        })
      });

      const data = await res.json();

      if (data?.success) {
        toast.success(t('p2pDeposit.depositVerified', { amount: data.amount, token }));
        setStep('success');
        onSuccess?.();
      } else {
        throw new Error(data?.error || t('p2pDeposit.verificationFailed'));
      }
    } catch (error) {
      console.error('Verify deposit error:', error);
      const message = error instanceof Error ? error.message : t('p2pDeposit.verificationFailed');
      setVerifyError(message);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'select':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>{t('p2pDeposit.selectToken')}</Label>
              <Select value={token} onValueChange={(v) => setToken(v as CryptoToken)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HEZ">{t('p2pDeposit.hezNative')}</SelectItem>
                  <SelectItem value="PEZ">{t('p2pDeposit.pez')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('p2pDeposit.amountToDeposit')}</Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0"
                  step="0.0001"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {token}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('p2pDeposit.walletBalance', { amount: parseFloat(getAvailableBalance()).toFixed(4), token })}
              </p>
            </div>

            <Alert>
              <Wallet className="h-4 w-4" />
              <AlertDescription>
                {t('p2pDeposit.depositInfo', { token })}
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                {t('cancel')}
              </Button>
              <Button
                onClick={() => setStep('send')}
                disabled={!amount || parseFloat(amount) <= 0}
              >
                {t('continue')}
              </Button>
            </DialogFooter>
          </div>
        );

      case 'send':
        return (
          <div className="space-y-6">
            <div className="p-4 rounded-lg bg-muted/50 border space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-primary/10 flex items-center justify-center">
                  <QrCode className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm font-medium">{t('p2pDeposit.sendAmountTo', { amount, token })}</p>
              </div>

              {platformWallet ? (
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-background border font-mono text-xs break-all">
                    {platformWallet}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleCopyAddress}
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                        {t('p2pDeposit.copied')}
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        {t('p2pDeposit.copyAddress')}
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <Skeleton className="h-16 w-full" />
              )}
            </div>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('p2pDeposit.networkWarning', { token })}
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep('select')}
              >
                {t('back')}
              </Button>
              <Button
                className="flex-1"
                onClick={handleSendDeposit}
                disabled={loading || !platformWallet}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('p2pDeposit.sending')}
                  </>
                ) : (
                  <>
                    {t('p2pDeposit.sendToken', { amount, token })}
                  </>
                )}
              </Button>
            </div>
          </div>
        );

      case 'verifying':
        return (
          <div className="space-y-6">
            {verifyError ? (
              <>
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-destructive">
                      {t('p2pDeposit.verifyFailed')}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2">{verifyError}</p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 border">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t('p2pDeposit.tokenLabel')}</p>
                      <p className="font-semibold">{token}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('p2pDeposit.amountLabel')}</p>
                      <p className="font-semibold">{amount}</p>
                    </div>
                  </div>
                  {txHash && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-muted-foreground text-xs">TX</p>
                      <p className="font-mono text-xs break-all">{txHash}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleClose}>
                    {t('cancel')}
                  </Button>
                  <Button className="flex-1" onClick={() => handleVerifyDeposit()}>
                    {t('p2pDeposit.retry')}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center space-y-4 py-4">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                <div>
                  <h3 className="text-lg font-semibold">{t('p2pDeposit.autoVerifying')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('p2pDeposit.autoVerifyingDesc')}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t('p2pDeposit.tokenLabel')}</p>
                      <p className="font-semibold">{token}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('p2pDeposit.amountLabel')}</p>
                      <p className="font-semibold">{amount}</p>
                    </div>
                  </div>
                  {txHash && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-muted-foreground text-xs">TX</p>
                      <p className="font-mono text-xs break-all">{txHash}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case 'success':
        return (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>

            <div>
              <h3 className="text-xl font-semibold text-green-500">
                {t('p2pDeposit.depositSuccess')}
              </h3>
              <p className="text-muted-foreground mt-2">
                {t('p2pDeposit.addedToBalance', { amount, token })}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-sm text-muted-foreground">
                {t('p2pDeposit.successInfo')}
              </p>
            </div>

            <Button onClick={handleClose} className="w-full">
              {t('p2pDeposit.done')}
            </Button>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {t('p2pDeposit.title')}
          </DialogTitle>
          {step !== 'success' && (
            <DialogDescription>
              {step === 'select' && t('p2pDeposit.selectStep')}
              {step === 'send' && t('p2pDeposit.sendStep')}
              {step === 'verifying' && t('p2pDeposit.autoVerifying')}
            </DialogDescription>
          )}
        </DialogHeader>

        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
}
