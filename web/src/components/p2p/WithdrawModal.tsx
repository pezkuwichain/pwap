import { useState, useEffect, useCallback } from 'react';
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
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowUpFromLine,
  Clock,
  Info
} from 'lucide-react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useP2PIdentity } from '@/contexts/P2PIdentityContext';
import { toast } from 'sonner';
import {
  getInternalBalances,
  requestWithdraw,
  getDepositWithdrawHistory,
  type CryptoToken,
  type InternalBalance,
  type DepositWithdrawRequest
} from '@shared/lib/p2p-fiat';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type WithdrawStep = 'form' | 'confirm' | 'success';

export function WithdrawModal({ isOpen, onClose, onSuccess }: WithdrawModalProps) {
  const { t } = useTranslation();
  const { selectedAccount } = usePezkuwi();
  const { userId } = useP2PIdentity();

  const [step, setStep] = useState<WithdrawStep>('form');
  const [token, setToken] = useState<CryptoToken>('HEZ');
  const [amount, setAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [balances, setBalances] = useState<InternalBalance[]>([]);
  const [pendingRequests, setPendingRequests] = useState<DepositWithdrawRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId] = useState<string>('');

  // Network fee estimate (in HEZ)
  const NETWORK_FEE = 0.01;
  const MIN_WITHDRAWAL = 0.1;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (!userId) return;
      const [balanceData, historyData] = await Promise.all([
        getInternalBalances(userId),
        getDepositWithdrawHistory(userId)
      ]);
      setBalances(balanceData);
      // Filter for pending withdrawal requests
      setPendingRequests(
        historyData.filter(r => r.request_type === 'withdraw' && r.status === 'pending')
      );
    } catch (error) {
      console.error('Fetch data error:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch balances and pending requests on mount
  useEffect(() => {
    if (isOpen) {
      fetchData();
      // Pre-fill wallet address from connected account
      if (selectedAccount?.address) {
        setWalletAddress(selectedAccount.address);
      }
    }
  }, [isOpen, selectedAccount, fetchData]);

  const resetModal = () => {
    setStep('form');
    setAmount('');
    setSubmitting(false);
    setRequestId('');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const getAvailableBalance = (): number => {
    const balance = balances.find(b => b.token === token);
    return balance?.available_balance || 0;
  };

  const getLockedBalance = (): number => {
    const balance = balances.find(b => b.token === token);
    return balance?.locked_balance || 0;
  };

  const getMaxWithdrawable = (): number => {
    const available = getAvailableBalance();
    // Subtract network fee for HEZ
    if (token === 'HEZ') {
      return Math.max(0, available - NETWORK_FEE);
    }
    return available;
  };

  const handleSetMax = () => {
    const max = getMaxWithdrawable();
    setAmount(max.toFixed(4));
  };

  const validateWithdrawal = (): string | null => {
    const withdrawAmount = parseFloat(amount);

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return t('p2pWithdraw.enterValidAmount');
    }

    if (withdrawAmount < MIN_WITHDRAWAL) {
      return t('p2pWithdraw.minimumWithdrawal', { amount: MIN_WITHDRAWAL, token });
    }

    if (withdrawAmount > getMaxWithdrawable()) {
      return t('p2pWithdraw.insufficientBalance');
    }

    if (!walletAddress || walletAddress.length < 40) {
      return t('p2pWithdraw.invalidAddress');
    }

    return null;
  };

  const handleContinue = () => {
    const error = validateWithdrawal();
    if (error) {
      toast.error(error);
      return;
    }
    setStep('confirm');
  };

  const handleSubmitWithdrawal = async () => {
    const error = validateWithdrawal();
    if (error) {
      toast.error(error);
      return;
    }

    setSubmitting(true);

    try {
      const withdrawAmount = parseFloat(amount);
      if (!userId) throw new Error('Identity required');
      const id = await requestWithdraw(userId, token, withdrawAmount, walletAddress);
      setRequestId(id);
      setStep('success');
      onSuccess?.();
    } catch (error) {
      console.error('Submit withdrawal error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const renderFormStep = () => (
    <div className="space-y-6">
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <>
          {/* Token Selection */}
          <div className="space-y-2">
            <Label>{t('p2pWithdraw.selectToken')}</Label>
            <Select value={token} onValueChange={(v) => setToken(v as CryptoToken)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HEZ">{t('p2pWithdraw.hezNative')}</SelectItem>
                <SelectItem value="PEZ">{t('p2pWithdraw.pez')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Balance Display */}
          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t('p2pWithdraw.available')}</p>
                <p className="font-semibold text-green-500">
                  {getAvailableBalance().toFixed(4)} {token}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('p2pWithdraw.lockedEscrow')}</p>
                <p className="font-semibold text-yellow-500">
                  {getLockedBalance().toFixed(4)} {token}
                </p>
              </div>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label>{t('p2pWithdraw.withdrawalAmount')}</Label>
            <div className="relative">
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.0001"
              />
              <div className="absolute right-14 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {token}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 text-xs"
                onClick={handleSetMax}
              >
                {t('p2pWithdraw.max')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('p2pWithdraw.minMax', { min: MIN_WITHDRAWAL, max: getMaxWithdrawable().toFixed(4), token })}
            </p>
          </div>

          {/* Wallet Address */}
          <div className="space-y-2">
            <Label>{t('p2pWithdraw.destinationAddress')}</Label>
            <Input
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="5..."
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              {t('p2pWithdraw.onlyPezkuwiAddresses')}
            </p>
          </div>

          {/* Network Fee Info */}
          {token === 'HEZ' && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {t('p2pWithdraw.networkFee', { fee: NETWORK_FEE })}
              </AlertDescription>
            </Alert>
          )}

          {/* Pending Requests Info */}
          {pendingRequests.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {t('p2pWithdraw.pendingWarning', { count: pendingRequests.length })}
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleContinue}
              disabled={!amount || parseFloat(amount) <= 0}
            >
              {t('continue')}
            </Button>
          </DialogFooter>
        </>
      )}
    </div>
  );

  const renderConfirmStep = () => {
    const withdrawAmount = parseFloat(amount);
    const receiveAmount = token === 'HEZ' ? withdrawAmount - NETWORK_FEE : withdrawAmount;

    return (
      <div className="space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {t('p2pWithdraw.reviewWarning')}
          </AlertDescription>
        </Alert>

        <div className="p-4 rounded-lg bg-muted/50 border space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">{t('p2pWithdraw.tokenLabel')}</span>
            <span className="font-semibold">{token}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">{t('p2pWithdraw.withdrawalAmountLabel')}</span>
            <span className="font-semibold">{withdrawAmount.toFixed(4)} {token}</span>
          </div>
          {token === 'HEZ' && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t('p2pWithdraw.networkFeeLabel')}</span>
              <span className="text-yellow-500">-{NETWORK_FEE} HEZ</span>
            </div>
          )}
          <div className="border-t pt-4 flex justify-between items-center">
            <span className="text-muted-foreground">{t('p2pWithdraw.youWillReceive')}</span>
            <span className="font-bold text-lg text-green-500">
              {receiveAmount.toFixed(4)} {token}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-muted/30 border">
          <p className="text-xs text-muted-foreground mb-1">{t('p2pWithdraw.destinationAddressLabel')}</p>
          <p className="font-mono text-xs break-all">{walletAddress}</p>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{t('p2pWithdraw.processingTime')}</span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setStep('form')}>
            {t('back')}
          </Button>
          <Button
            onClick={handleSubmitWithdrawal}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('p2pWithdraw.processing')}
              </>
            ) : (
              <>
                <ArrowUpFromLine className="h-4 w-4 mr-2" />
                {t('p2pWithdraw.confirmWithdrawal')}
              </>
            )}
          </Button>
        </DialogFooter>
      </div>
    );
  };

  const renderSuccessStep = () => (
    <div className="space-y-6 text-center">
      <div className="w-20 h-20 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
      </div>

      <div>
        <h3 className="text-xl font-semibold text-green-500">
          {t('p2pWithdraw.requestSubmitted')}
        </h3>
        <p className="text-muted-foreground mt-2">
          {t('p2pWithdraw.requestSubmittedDesc')}
        </p>
      </div>

      <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('p2pWithdraw.requestId')}</span>
          <Badge variant="outline" className="font-mono text-xs">
            {requestId.slice(0, 8)}...
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('p2pWithdraw.statusLabel')}</span>
          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
            <Clock className="h-3 w-3 mr-1" />
            {t('p2pWithdraw.statusProcessing')}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('p2pWithdraw.amountLabel')}</span>
          <span className="font-semibold">{amount} {token}</span>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {t('p2pWithdraw.trackInfo')}
        </AlertDescription>
      </Alert>

      <Button onClick={handleClose} className="w-full">
        {t('p2pWithdraw.done')}
      </Button>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpFromLine className="h-5 w-5" />
            {t('p2pWithdraw.title')}
          </DialogTitle>
          {step !== 'success' && (
            <DialogDescription>
              {step === 'form' && t('p2pWithdraw.formStep')}
              {step === 'confirm' && t('p2pWithdraw.confirmStep')}
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 'form' && renderFormStep()}
        {step === 'confirm' && renderConfirmStep()}
        {step === 'success' && renderSuccessStep()}
      </DialogContent>
    </Dialog>
  );
}
