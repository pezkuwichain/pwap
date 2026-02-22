import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Lock, AlertCircle, Loader2, Clock } from 'lucide-react';
import { web3FromAddress } from '@pezkuwi/extension-dapp';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TokenBalance {
  assetId: number;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  usdValue: number;
  isLpToken?: boolean;
}

interface LPStakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  lpToken: TokenBalance | null;
  onStakeSuccess?: () => void;
}

// Pool ID mapping: LP Token assetId -> Staking Pool ID
const LP_TO_POOL_ID: Record<number, number> = {
  0: 0, // HEZ-PEZ LP -> Pool 0
  1: 1, // HEZ-USDT LP -> Pool 1
  2: 2, // HEZ-DOT LP -> Pool 2
};

interface DurationOption {
  label: string;
  months: number;
  multiplier: number; // Reward multiplier (for display)
}

const DURATION_OPTIONS: DurationOption[] = [
  { label: 'lpStake.month1', months: 1, multiplier: 1 },
  { label: 'lpStake.month3', months: 3, multiplier: 1.5 },
  { label: 'lpStake.month6', months: 6, multiplier: 2 },
  { label: 'lpStake.year1', months: 12, multiplier: 3 },
];

export const LPStakeModal: React.FC<LPStakeModalProps> = ({
  isOpen,
  onClose,
  lpToken,
  onStakeSuccess,
}) => {
  const { t } = useTranslation();
  const { assetHubApi, selectedAccount, isAssetHubReady } = usePezkuwi();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<number>(1); // months

  if (!isOpen || !lpToken) return null;

  const poolId = LP_TO_POOL_ID[lpToken.assetId];
  const maxBalance = parseFloat(lpToken.balance);

  const handleStake = async () => {
    if (!assetHubApi || !isAssetHubReady || !selectedAccount || poolId === undefined) {
      setError(t('lpStake.apiNotReady'));
      return;
    }

    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) {
      setError(t('lpStake.invalidAmount'));
      return;
    }

    if (amount > maxBalance) {
      setError(t('lpStake.insufficientBalance'));
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const amountBN = BigInt(Math.floor(amount * 1e12));
      const injector = await web3FromAddress(selectedAccount.address);

      const tx = assetHubApi.tx.assetRewards.stake(poolId, amountBN.toString());

      await new Promise<void>((resolve, reject) => {
        tx.signAndSend(
          selectedAccount.address,
          { signer: injector.signer },
          ({ status, dispatchError }) => {
            if (status.isFinalized) {
              if (dispatchError) {
                if (dispatchError.isModule) {
                  const decoded = assetHubApi.registry.findMetaError(dispatchError.asModule);
                  reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
                } else {
                  reject(new Error(dispatchError.toString()));
                }
              } else {
                resolve();
              }
            }
          }
        );
      });

      const durationOption = DURATION_OPTIONS.find(d => d.months === selectedDuration);
      const durationLabel = durationOption ? t(durationOption.label) : `${selectedDuration}`;
      setSuccess(t('lpStake.success', { amount: stakeAmount, symbol: lpToken.symbol, duration: durationLabel }));
      setStakeAmount('');

      if (onStakeSuccess) {
        onStakeSuccess();
      }

      // Close modal after success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('lpStake.failed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const setMaxAmount = () => {
    setStakeAmount(lpToken.balance);
  };

  const selectedDurationOption = DURATION_OPTIONS.find(d => d.months === selectedDuration);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-md w-full p-6 border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Lock className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{t('lpStake.title')}</h2>
              <p className="text-sm text-gray-400">{lpToken.symbol}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <Alert className="mb-4 bg-red-900/20 border-red-500">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 bg-green-900/20 border-green-500">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-5">
          {/* Duration Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              <Clock className="w-4 h-4 inline mr-2" />
              {t('lpStake.duration')}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {DURATION_OPTIONS.map((option) => (
                <button
                  key={option.months}
                  onClick={() => setSelectedDuration(option.months)}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    selectedDuration === option.months
                      ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                      : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                  }`}
                  disabled={isProcessing}
                >
                  <div className="text-sm font-medium">{t(option.label)}</div>
                  <div className="text-xs mt-1 text-gray-500">{option.multiplier}x</div>
                </button>
              ))}
            </div>
          </div>

          {/* Balance Info */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{t('lpStake.currentBalance')}</span>
              <span className="text-white font-medium">{lpToken.balance} {lpToken.symbol}</span>
            </div>
            {selectedDurationOption && (
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-400">{t('lpStake.rewardMultiplier')}</span>
                <span className="text-purple-400 font-medium">{selectedDurationOption.multiplier}x</span>
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('lpStake.stakeAmount')}
            </label>
            <div className="relative">
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder="0.0"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white pr-20"
                disabled={isProcessing}
                max={maxBalance}
                min={0}
                step="0.0001"
              />
              <button
                onClick={setMaxAmount}
                className="absolute right-3 top-3 text-purple-400 text-sm hover:text-purple-300 font-medium"
                disabled={isProcessing}
              >
                MAX
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {t('lpStake.poolId', { id: poolId })}
            </div>
          </div>

          {/* Warning */}
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-yellow-300">
                {t('lpStake.lockWarning')}
              </div>
            </div>
          </div>

          {/* Stake Button */}
          <Button
            onClick={handleStake}
            disabled={isProcessing || !stakeAmount || parseFloat(stakeAmount) <= 0}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 h-12 text-base font-medium"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('lpStake.staking')}
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                {t('lpStake.stakeBtn', { duration: selectedDurationOption ? t(selectedDurationOption.label) : '' })}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
