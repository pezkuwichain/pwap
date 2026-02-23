import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Lock, Unlock, Gift, AlertCircle, Loader2, Info } from 'lucide-react';
import { getSigner } from '@/lib/get-signer';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface StakingPool {
  poolId: number;
  stakedAsset: string;
  rewardAsset: string;
  rewardRatePerBlock: string;
  totalStaked: string;
  userStaked: string;
  pendingRewards: string;
  lpTokenId: number;
  lpBalance: string;
}

interface LPStakingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LP_TOKEN_NAMES: Record<number, string> = {
  0: 'HEZ-PEZ LP',
  1: 'HEZ-USDT LP',
  2: 'HEZ-DOT LP',
};

export const LPStakingModal: React.FC<LPStakingModalProps> = ({ isOpen, onClose }) => {
  const { assetHubApi, selectedAccount, isAssetHubReady, walletSource } = usePezkuwi();
  const { t } = useTranslation();
  const [pools, setPools] = useState<StakingPool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedPool, setSelectedPool] = useState<number | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [activeTab, setActiveTab] = useState('stake');

  useEffect(() => {
    if (!assetHubApi || !isAssetHubReady || !isOpen) return;

    const fetchPools = async () => {
      setIsLoading(true);
      try {
        const poolEntries = await assetHubApi.query.assetRewards.pools.entries();
        const stakingPools: StakingPool[] = [];

        for (const [key, value] of poolEntries) {
          const poolId = parseInt(key.args[0].toString());
          const poolData = value.toJSON() as {
            stakedAssetId: { interior: { x2: [{ palletInstance: number }, { generalIndex: number }] } };
            rewardAssetId: { interior: { x2: [{ palletInstance: number }, { generalIndex: number }] } };
            rewardRatePerBlock: string;
            totalTokensStaked: string;
          };

          const lpTokenId = poolData.stakedAssetId?.interior?.x2?.[1]?.generalIndex ?? poolId;

          let userStaked = '0';
          let pendingRewards = '0';
          let lpBalance = '0';

          if (selectedAccount) {
            try {
              const stakeInfo = await assetHubApi.query.assetRewards.poolStakers([poolId, selectedAccount.address]);
              if (stakeInfo && (stakeInfo as { isSome: boolean }).isSome) {
                const stakeData = (stakeInfo as { unwrap: () => { toJSON: () => { amount: string; rewardPerTokenPaid?: string } } }).unwrap().toJSON();
                userStaked = stakeData.amount || '0';
              }

              // Fetch pending rewards from the pallet
              try {
                const rewardsResult = await (assetHubApi.call as { assetRewardsApi?: { pendingRewards: (poolId: number, account: string) => Promise<unknown> } })
                  .assetRewardsApi?.pendingRewards(poolId, selectedAccount.address);
                if (rewardsResult && typeof rewardsResult === 'object' && 'toString' in rewardsResult) {
                  pendingRewards = rewardsResult.toString();
                }
              } catch {
                // If runtime API not available, try direct calculation
                // pendingRewards stays 0
              }

              const lpBal = await assetHubApi.query.poolAssets.account(lpTokenId, selectedAccount.address);
              if (lpBal && (lpBal as { isSome: boolean }).isSome) {
                const lpData = (lpBal as { unwrap: () => { toJSON: () => { balance: string } } }).unwrap().toJSON();
                lpBalance = lpData.balance || '0';
              }
            } catch {
              // Ignore errors
            }
          }

          stakingPools.push({
            poolId,
            stakedAsset: LP_TOKEN_NAMES[lpTokenId] || `LP Token #${lpTokenId}`,
            rewardAsset: 'PEZ',
            rewardRatePerBlock: poolData.rewardRatePerBlock || '0',
            totalStaked: poolData.totalTokensStaked || '0',
            userStaked,
            pendingRewards,
            lpTokenId,
            lpBalance,
          });
        }

        setPools(stakingPools);
        if (stakingPools.length > 0 && selectedPool === null) {
          setSelectedPool(stakingPools[0].poolId);
        }
      } catch (err) {
        console.error('Error fetching staking pools:', err);
        setError(t('lpStaking.fetchError'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchPools();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetHubApi, isAssetHubReady, isOpen, selectedAccount, selectedPool]);

  const formatAmount = (amount: string, decimals: number = 12): string => {
    const value = Number(amount) / Math.pow(10, decimals);
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  const handleStake = async () => {
    if (!assetHubApi || !selectedAccount || selectedPool === null || !stakeAmount) return;

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const pool = pools.find(p => p.poolId === selectedPool);
      if (!pool) throw new Error('Pool not found');

      const amountBN = BigInt(Math.floor(parseFloat(stakeAmount) * 1e12));
      const injector = await getSigner(selectedAccount.address, walletSource, assetHubApi);

      const tx = assetHubApi.tx.assetRewards.stake(selectedPool, amountBN.toString());

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

      setSuccess(t('lpStaking.stakeSuccess', { amount: stakeAmount, asset: pool.stakedAsset }));
      setStakeAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('lpStaking.stakeFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnstake = async () => {
    if (!assetHubApi || !selectedAccount || selectedPool === null || !unstakeAmount) return;

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const pool = pools.find(p => p.poolId === selectedPool);
      if (!pool) throw new Error('Pool not found');

      const amountBN = BigInt(Math.floor(parseFloat(unstakeAmount) * 1e12));
      const injector = await getSigner(selectedAccount.address, walletSource, assetHubApi);

      const tx = assetHubApi.tx.assetRewards.unstake(selectedPool, amountBN.toString());

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

      setSuccess(t('lpStaking.unstakeSuccess', { amount: unstakeAmount, asset: pool.stakedAsset }));
      setUnstakeAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('lpStaking.unstakeFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleHarvest = async () => {
    if (!assetHubApi || !selectedAccount || selectedPool === null) return;

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const injector = await getSigner(selectedAccount.address, walletSource, assetHubApi);
      const tx = assetHubApi.tx.assetRewards.harvestRewards(selectedPool);

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

      setSuccess(t('lpStaking.harvestSuccess'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('lpStaking.harvestFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const currentPool = pools.find(p => p.poolId === selectedPool);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-lg w-full p-6 border border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">{t('lpStaking.title')}</h2>
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

        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-cyan-400" />
            <p className="text-gray-400 mt-2">{t('lpStaking.loading')}</p>
          </div>
        ) : pools.length === 0 ? (
          <Alert className="bg-yellow-900/20 border-yellow-500">
            <Info className="h-4 w-4" />
            <AlertDescription>{t('lpStaking.noPools')}</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('lpStaking.selectPool')}</label>
              <select
                value={selectedPool ?? ''}
                onChange={(e) => setSelectedPool(parseInt(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
              >
                {pools.map((pool) => (
                  <option key={pool.poolId} value={pool.poolId}>
                    {pool.stakedAsset} → {pool.rewardAsset}
                  </option>
                ))}
              </select>
            </div>

            {currentPool && (
              <div className="bg-gray-800/50 rounded-lg p-4 mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{t('lpStaking.totalStaked')}</span>
                  <span className="text-white">{formatAmount(currentPool.totalStaked)} LP</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{t('lpStaking.yourStaked')}</span>
                  <span className="text-white">{formatAmount(currentPool.userStaked)} LP</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{t('lpStaking.yourLpBalance')}</span>
                  <span className="text-white">{formatAmount(currentPool.lpBalance)} LP</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{t('lpStaking.rewardRate')}</span>
                  <span className="text-cyan-400">{formatAmount(currentPool.rewardRatePerBlock)} PEZ/block</span>
                </div>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full mb-4">
                <TabsTrigger value="stake" className="flex-1">
                  <Lock className="w-4 h-4 mr-2" />
                  {t('lpStaking.tabStake')}
                </TabsTrigger>
                <TabsTrigger value="unstake" className="flex-1">
                  <Unlock className="w-4 h-4 mr-2" />
                  {t('lpStaking.tabUnstake')}
                </TabsTrigger>
                <TabsTrigger value="harvest" className="flex-1">
                  <Gift className="w-4 h-4 mr-2" />
                  {t('lpStaking.tabHarvest')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="stake">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">{t('lpStaking.amountToStake')}</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        placeholder="0.0"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
                        disabled={isProcessing}
                      />
                      <button
                        onClick={() => currentPool && setStakeAmount((Number(currentPool.lpBalance) / 1e12).toString())}
                        className="absolute right-3 top-3 text-cyan-400 text-sm hover:text-cyan-300"
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                  <Button
                    onClick={handleStake}
                    disabled={isProcessing || !stakeAmount}
                    className="w-full bg-gradient-to-r from-green-600 to-cyan-600 h-12"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                    {isProcessing ? t('lpStaking.staking') : t('lpStaking.stakeLp')}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="unstake">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">{t('lpStaking.amountToUnstake')}</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={unstakeAmount}
                        onChange={(e) => setUnstakeAmount(e.target.value)}
                        placeholder="0.0"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
                        disabled={isProcessing}
                      />
                      <button
                        onClick={() => currentPool && setUnstakeAmount((Number(currentPool.userStaked) / 1e12).toString())}
                        className="absolute right-3 top-3 text-cyan-400 text-sm hover:text-cyan-300"
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                  <Button
                    onClick={handleUnstake}
                    disabled={isProcessing || !unstakeAmount}
                    className="w-full bg-gradient-to-r from-orange-600 to-red-600 h-12"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unlock className="w-4 h-4 mr-2" />}
                    {isProcessing ? t('lpStaking.unstaking') : t('lpStaking.unstakeLp')}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="harvest">
                <div className="space-y-4">
                  <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                    <p className="text-gray-400 mb-2">{t('lpStaking.pendingRewards')}</p>
                    <p className="text-3xl font-bold text-cyan-400">
                      {currentPool ? formatAmount(currentPool.pendingRewards) : '0'} PEZ
                    </p>
                  </div>
                  <Button
                    onClick={handleHarvest}
                    disabled={isProcessing}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 h-12"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gift className="w-4 h-4 mr-2" />}
                    {isProcessing ? t('lpStaking.harvesting') : t('lpStaking.harvestRewards')}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
};
