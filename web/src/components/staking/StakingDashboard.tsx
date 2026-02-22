import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
// import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { web3FromAddress, web3Enable } from '@pezkuwi/extension-dapp';
import {
  getStakingInfo,
  getActiveValidators,
  getMinNominatorBond,
  getBondingDuration,
  getCurrentEra,
  parseAmount,
  type StakingInfo
} from '@pezkuwi/lib/staking';
import {
  recordTrustScore,
  claimPezReward,
  getPezRewards,
  type PezRewardInfo
} from '@pezkuwi/lib/scores';
import { LoadingState } from '@pezkuwi/components/AsyncComponent';
import { ValidatorPoolDashboard } from './ValidatorPoolDashboard';
import { handleBlockchainError, handleBlockchainSuccess } from '@pezkuwi/lib/error-handler';

// Get signer with auto-reconnect if extension session expired
async function getInjectorSigner(address: string) {
  let injector = await web3FromAddress(address);
  if (!injector?.signer) {
    await web3Enable('PezkuwiChain');
    injector = await web3FromAddress(address);
    if (!injector?.signer) {
      throw new Error('Wallet signer not available. Please reconnect your wallet.');
    }
  }
  return injector;
}

export const StakingDashboard: React.FC = () => {
  const { assetHubApi, peopleApi, selectedAccount, isAssetHubReady, isPeopleReady } = usePezkuwi();
  const { balances, refreshBalances } = useWallet();
  const { t } = useTranslation();

  const [stakingInfo, setStakingInfo] = useState<StakingInfo | null>(null);
  const [validators, setValidators] = useState<string[]>([]);
  const [minNominatorBond, setMinNominatorBond] = useState('0');
  const [bondingDuration, setBondingDuration] = useState(28);

  const [bondAmount, setBondAmount] = useState('');
  const [unbondAmount, setUnbondAmount] = useState('');
  const [selectedValidators, setSelectedValidators] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [pezRewards, setPezRewards] = useState<PezRewardInfo | null>(null);
  const [isRecordingScore, setIsRecordingScore] = useState(false);
  const [isClaimingReward, setIsClaimingReward] = useState(false);

  // Fetch staking data from Asset Hub
  useEffect(() => {
    const fetchStakingData = async () => {
      if (!assetHubApi || !isAssetHubReady || !selectedAccount) {
        return;
      }

      setIsLoadingData(true);
      try {
        const [info, activeVals, minBond, duration, era] = await Promise.all([
          getStakingInfo(assetHubApi, selectedAccount.address, peopleApi || undefined),
          getActiveValidators(assetHubApi),
          getMinNominatorBond(assetHubApi),
          getBondingDuration(assetHubApi),
          getCurrentEra(assetHubApi)
        ]);

        setStakingInfo(info);
        setValidators(activeVals);
        setMinNominatorBond(minBond);
        setBondingDuration(duration);
        // Track current era for future use
        if (import.meta.env.DEV) console.log('Current era:', era);

        // Pre-select current nominations if any
        if (info.nominations.length > 0) {
          setSelectedValidators(info.nominations);
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error('Failed to fetch staking data:', error);
        toast.error(t('staking.fetchError'));
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchStakingData();
    const interval = setInterval(fetchStakingData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetHubApi, peopleApi, isAssetHubReady, isPeopleReady, selectedAccount]);

  // Fetch PEZ rewards data separately from People Chain
  useEffect(() => {
    const fetchPezRewards = async () => {
      if (!peopleApi || !isPeopleReady || !selectedAccount) return;

      try {
        const rewards = await getPezRewards(peopleApi, selectedAccount.address);
        setPezRewards(rewards);
      } catch (error) {
        if (import.meta.env.DEV) console.warn('Failed to fetch PEZ rewards:', error);
      }
    };

    fetchPezRewards();
    const interval = setInterval(fetchPezRewards, 30000);
    return () => clearInterval(interval);
  }, [peopleApi, isPeopleReady, selectedAccount]);

  const handleRecordTrustScore = async () => {
    if (!peopleApi || !selectedAccount) return;

    setIsRecordingScore(true);
    try {
      const injector = await getInjectorSigner(selectedAccount.address);
      const result = await recordTrustScore(peopleApi, selectedAccount.address, injector.signer);

      if (result.success) {
        handleBlockchainSuccess('pezRewards.recorded', toast);
        // Refresh PEZ rewards data
        setTimeout(async () => {
          if (peopleApi && selectedAccount) {
            const rewards = await getPezRewards(peopleApi, selectedAccount.address);
            setPezRewards(rewards);
          }
        }, 3000);
      } else {
        toast.error(result.error || t('staking.recordFailed'));
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Record trust score failed:', error);
      toast.error(error instanceof Error ? error.message : t('staking.recordFailed'));
    } finally {
      setIsRecordingScore(false);
    }
  };

  const handleClaimReward = async (epochIndex: number) => {
    if (!peopleApi || !selectedAccount) return;

    setIsClaimingReward(true);
    try {
      const injector = await getInjectorSigner(selectedAccount.address);
      const result = await claimPezReward(peopleApi, selectedAccount.address, epochIndex, injector.signer);

      if (result.success) {
        const rewardInfo = pezRewards?.claimableRewards.find(r => r.epoch === epochIndex);
        handleBlockchainSuccess('pezRewards.claimed', toast, { amount: rewardInfo?.amount || '0' });
        refreshBalances();
        // Refresh PEZ rewards data
        setTimeout(async () => {
          if (peopleApi && selectedAccount) {
            const rewards = await getPezRewards(peopleApi, selectedAccount.address);
            setPezRewards(rewards);
          }
        }, 3000);
      } else {
        toast.error(result.error || t('staking.claimFailed'));
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Claim reward failed:', error);
      toast.error(error instanceof Error ? error.message : t('staking.claimFailed'));
    } finally {
      setIsClaimingReward(false);
    }
  };

  const handleBond = async () => {
    if (!assetHubApi || !selectedAccount || !bondAmount) return;

    setIsLoading(true);
    try {
      const amount = parseAmount(bondAmount);

      // Validate
      if (parseFloat(bondAmount) < parseFloat(minNominatorBond)) {
        throw new Error(t('staking.minBondError', { amount: minNominatorBond }));
      }

      if (parseFloat(bondAmount) > parseFloat(balances.HEZ)) {
        throw new Error(t('staking.insufficientHez'));
      }

      const injector = await getInjectorSigner(selectedAccount.address);

      // If already bonded, use bondExtra, otherwise use bond
      let tx;
      if (stakingInfo && parseFloat(stakingInfo.bonded) > 0) {
        tx = assetHubApi.tx.staking.bondExtra(amount);
      } else {
        // For new bond, also need to specify reward destination
        tx = assetHubApi.tx.staking.bond(amount, 'Staked'); // Auto-compound rewards
      }

      await tx.signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        ({ status, dispatchError }) => {
          if (status.isInBlock) {
            if (import.meta.env.DEV) console.log('Transaction in block:', status.asInBlock.toHex());

            if (dispatchError) {
              handleBlockchainError(dispatchError, assetHubApi, toast);
              setIsLoading(false);
            } else {
              handleBlockchainSuccess('staking.bonded', toast, { amount: bondAmount });
              setBondAmount('');
              refreshBalances();
              // Refresh staking data after a delay
              setTimeout(() => {
                if (assetHubApi && selectedAccount) {
                  getStakingInfo(assetHubApi, selectedAccount.address, peopleApi || undefined).then(setStakingInfo);
                }
              }, 3000);
              setIsLoading(false);
            }
          }
        }
      );
    } catch (error) {
      if (import.meta.env.DEV) console.error('Bond failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to bond tokens');
      setIsLoading(false);
    }
  };

  const handleNominate = async () => {
    if (!assetHubApi || !selectedAccount || selectedValidators.length === 0) return;

    if (!stakingInfo || parseFloat(stakingInfo.bonded) === 0) {
      toast.error(t('staking.bondBeforeNominate'));
      return;
    }

    setIsLoading(true);
    try {
      const injector = await getInjectorSigner(selectedAccount.address);

      const tx = assetHubApi.tx.staking.nominate(selectedValidators);

      await tx.signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        ({ status, dispatchError }) => {
          if (status.isInBlock) {
            if (dispatchError) {
              handleBlockchainError(dispatchError, assetHubApi, toast);
              setIsLoading(false);
            } else {
              handleBlockchainSuccess('staking.nominated', toast, { count: selectedValidators.length.toString() });
              // Refresh staking data
              setTimeout(() => {
                if (assetHubApi && selectedAccount) {
                  getStakingInfo(assetHubApi, selectedAccount.address, peopleApi || undefined).then(setStakingInfo);
                }
              }, 3000);
              setIsLoading(false);
            }
          }
        }
      );
    } catch (error) {
      if (import.meta.env.DEV) console.error('Nomination failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to nominate validators');
      setIsLoading(false);
    }
  };

  const handleUnbond = async () => {
    if (!assetHubApi || !selectedAccount || !unbondAmount) return;

    setIsLoading(true);
    try {
      const amount = parseAmount(unbondAmount);

      if (!stakingInfo || parseFloat(unbondAmount) > parseFloat(stakingInfo.active)) {
        throw new Error(t('staking.insufficientStaked'));
      }

      const injector = await getInjectorSigner(selectedAccount.address);
      const tx = assetHubApi.tx.staking.unbond(amount);

      await tx.signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        ({ status, dispatchError }) => {
          if (status.isInBlock) {
            if (dispatchError) {
              handleBlockchainError(dispatchError, assetHubApi, toast);
              setIsLoading(false);
            } else {
              handleBlockchainSuccess('staking.unbonded', toast, {
                amount: unbondAmount,
                duration: bondingDuration.toString()
              });
              setUnbondAmount('');
              setTimeout(() => {
                if (assetHubApi && selectedAccount) {
                  getStakingInfo(assetHubApi, selectedAccount.address, peopleApi || undefined).then(setStakingInfo);
                }
              }, 3000);
              setIsLoading(false);
            }
          }
        }
      );
    } catch (error) {
      if (import.meta.env.DEV) console.error('Unbond failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to unbond tokens');
      setIsLoading(false);
    }
  };

  const handleWithdrawUnbonded = async () => {
    if (!assetHubApi || !selectedAccount) return;

    if (!stakingInfo || parseFloat(stakingInfo.redeemable) === 0) {
      toast.info(t('staking.noWithdraw'));
      return;
    }

    setIsLoading(true);
    try {
      const injector = await getInjectorSigner(selectedAccount.address);

      // Number of slashing spans (usually 0)
      const tx = assetHubApi.tx.staking.withdrawUnbonded(0);

      await tx.signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        ({ status, dispatchError }) => {
          if (status.isInBlock) {
            if (dispatchError) {
              let errorMessage = t('staking.withdrawFailed');
              if (dispatchError.isModule) {
                const decoded = assetHubApi.registry.findMetaError(dispatchError.asModule);
                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
              }
              toast.error(errorMessage);
              setIsLoading(false);
            } else {
              toast.success(t('staking.withdrawSuccess', { amount: stakingInfo.redeemable }));
              refreshBalances();
              setTimeout(() => {
                if (assetHubApi && selectedAccount) {
                  getStakingInfo(assetHubApi, selectedAccount.address, peopleApi || undefined).then(setStakingInfo);
                }
              }, 3000);
              setIsLoading(false);
            }
          }
        }
      );
    } catch (error) {
      if (import.meta.env.DEV) console.error('Withdrawal failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to withdraw tokens');
      setIsLoading(false);
    }
  };

  const handleStartScoreTracking = async () => {
    if (!peopleApi || !selectedAccount) return;

    setIsLoading(true);
    try {
      const injector = await getInjectorSigner(selectedAccount.address);
      // stakingScore pallet is on People Chain - uses cached staking data from Asset Hub
      const tx = peopleApi.tx.stakingScore.startScoreTracking();

      await tx.signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        ({ status, dispatchError }) => {
          if (status.isInBlock) {
            if (dispatchError) {
              let errorMessage = t('staking.scoreTrackingFailed');
              if (dispatchError.isModule) {
                const decoded = peopleApi.registry.findMetaError(dispatchError.asModule);
                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
              }
              toast.error(errorMessage);
              setIsLoading(false);
            } else {
              toast.success(t('staking.scoreTrackingSuccess'));
              // Refresh staking data after a delay
              setTimeout(() => {
                if (assetHubApi && selectedAccount) {
                  getStakingInfo(assetHubApi, selectedAccount.address, peopleApi || undefined).then(setStakingInfo);
                }
              }, 3000);
              setIsLoading(false);
            }
          }
        }
      );
    } catch (error) {
      if (import.meta.env.DEV) console.error('Start score tracking failed:', error);
      toast.error(error instanceof Error ? error.message : t('staking.scoreTrackingFailed'));
      setIsLoading(false);
    }
  };

  const toggleValidator = (validator: string) => {
    setSelectedValidators(prev => {
      if (prev.includes(validator)) {
        return prev.filter(v => v !== validator);
      } else {
        // Max 16 nominations
        if (prev.length >= 16) {
          toast.info(t('staking.maxValidators'));
          return prev;
        }
        return [...prev, validator];
      }
    });
  };

  if (isLoadingData) {
    return <LoadingState message={t('staking.loadingData')} />;
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${pezRewards ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">{t('staking.totalBonded')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stakingInfo?.bonded || '0'} HEZ
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('staking.activeAmount', { amount: stakingInfo?.active || '0' })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">{t('staking.unlocking')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {stakingInfo?.unlocking.reduce((sum, u) => sum + parseFloat(u.amount), 0).toFixed(2) || '0'} HEZ
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('staking.chunks', { count: stakingInfo?.unlocking.length || 0 })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">{t('staking.redeemable')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {stakingInfo?.redeemable || '0'} HEZ
            </div>
            <Button
              size="sm"
              onClick={handleWithdrawUnbonded}
              disabled={!stakingInfo || parseFloat(stakingInfo.redeemable) === 0 || isLoading}
              className="mt-2 w-full"
            >
              {t('staking.withdraw')}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">{t('staking.stakingScore')}</CardTitle>
          </CardHeader>
          <CardContent>
            {stakingInfo?.hasStartedScoreTracking ? (
              stakingInfo.hasCachedStakingData ? (
                <>
                  <div className="text-2xl font-bold text-purple-500">
                    {stakingInfo.stakingScore}/100
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('staking.scoreDuration', { days: stakingInfo.stakingDuration
                      ? Math.floor(stakingInfo.stakingDuration / (24 * 60 * 10))
                      : 0 })}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-lg font-bold text-yellow-500">{t('staking.waitingData')}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('staking.scoreTrackingStartedInfo')}
                  </p>
                </>
              )
            ) : (
              <>
                <div className="text-2xl font-bold text-gray-500">{t('staking.notStarted')}</div>
                <Button
                  size="sm"
                  onClick={handleStartScoreTracking}
                  disabled={!stakingInfo || isLoading}
                  className="mt-2 w-full bg-purple-600 hover:bg-purple-700"
                >
                  {t('staking.startScoreTracking')}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* PEZ Rewards - only show when pallet is available */}
        {pezRewards && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-gray-400">{t('staking.pezRewards')}</CardTitle>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  pezRewards.epochStatus === 'Open'
                    ? 'bg-green-500/20 text-green-400'
                    : pezRewards.epochStatus === 'ClaimPeriod'
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {pezRewards.epochStatus === 'Open' ? t('staking.epochOpen') : pezRewards.epochStatus === 'ClaimPeriod' ? t('staking.epochClaimPeriod') : t('staking.epochClosed')}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-xs text-gray-500">{t('staking.epoch', { epoch: pezRewards.currentEpoch })}</p>

                {/* Open epoch: Record score or show recorded score */}
                {pezRewards.epochStatus === 'Open' && (
                  pezRewards.hasRecordedThisEpoch ? (
                    <div>
                      <div className="text-lg font-bold text-green-400">
                        {t('staking.scoreLabel', { score: pezRewards.userScoreCurrentEpoch })}
                      </div>
                      <p className="text-xs text-gray-500">{t('staking.recordedForEpoch')}</p>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleRecordTrustScore}
                      disabled={isRecordingScore}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {isRecordingScore ? t('staking.recording') : t('staking.recordTrustScore')}
                    </Button>
                  )
                )}

                {/* Claimable rewards */}
                {pezRewards.hasPendingClaim && (
                  <>
                    <div className="text-2xl font-bold text-orange-500">
                      {parseFloat(pezRewards.totalClaimable).toFixed(2)} PEZ
                    </div>
                    <div className="space-y-1">
                      {pezRewards.claimableRewards.map((reward) => (
                        <div key={reward.epoch} className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">{t('staking.epochReward', { epoch: reward.epoch, amount: reward.amount })}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleClaimReward(reward.epoch)}
                            disabled={isClaimingReward}
                            className="h-6 text-xs px-2 border-orange-500 text-orange-400 hover:bg-orange-500/20"
                          >
                            {isClaimingReward ? '...' : t('staking.claim')}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Staking Interface */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-xl text-white">{t('staking.title')}</CardTitle>
          <CardDescription className="text-gray-400">
            {t('staking.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="stake">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="stake">{t('staking.tabStake')}</TabsTrigger>
              <TabsTrigger value="nominate">{t('staking.tabNominate')}</TabsTrigger>
              <TabsTrigger value="pool">{t('staking.tabPool')}</TabsTrigger>
              <TabsTrigger value="unstake">{t('staking.tabUnstake')}</TabsTrigger>
            </TabsList>

            {/* STAKE TAB */}
            <TabsContent value="stake" className="space-y-4">
              <Alert className="bg-blue-900/20 border-blue-500">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('staking.minBondInfo', { amount: minNominatorBond })}
                </AlertDescription>
              </Alert>

              <div>
                <Label>{t('staking.amountToBond')}</Label>
                <Input
                  type="number"
                  placeholder={`Min: ${minNominatorBond}`}
                  value={bondAmount}
                  onChange={(e) => setBondAmount(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                  disabled={isLoading}
                />
                <div className="flex justify-between mt-1 text-xs text-gray-400">
                  <span>{t('staking.available', { amount: balances.HEZ })}</span>
                  <button
                    onClick={() => setBondAmount(balances.HEZ)}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    {t('staking.max')}
                  </button>
                </div>
              </div>

              <Button
                onClick={handleBond}
                disabled={isLoading || !bondAmount || parseFloat(bondAmount) < parseFloat(minNominatorBond)}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {stakingInfo && parseFloat(stakingInfo.bonded) > 0 ? t('staking.bondAdditional') : t('staking.bondTokens')}
              </Button>
            </TabsContent>

            {/* NOMINATE TAB */}
            <TabsContent value="nominate" className="space-y-4">
              <Alert className="bg-purple-900/20 border-purple-500">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('staking.nominateInfo')}
                  {stakingInfo && parseFloat(stakingInfo.bonded) === 0 && ` ${t('staking.bondFirst')}`}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>{t('staking.activeValidators', { count: validators.length })}</Label>
                <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-700 rounded-lg p-3 bg-gray-800">
                  {validators.map((validator) => (
                    <div
                      key={validator}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                        selectedValidators.includes(validator)
                          ? 'bg-purple-900/30 border border-purple-500'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                      onClick={() => toggleValidator(validator)}
                    >
                      <span className="text-sm font-mono truncate flex-1">
                        {validator.slice(0, 8)}...{validator.slice(-8)}
                      </span>
                      {selectedValidators.includes(validator) && (
                        <CheckCircle2 className="w-4 h-4 text-purple-400 ml-2" />
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  {t('staking.selected', { count: selectedValidators.length })}
                </p>
              </div>

              <Button
                onClick={handleNominate}
                disabled={isLoading || selectedValidators.length === 0 || !stakingInfo || parseFloat(stakingInfo.bonded) === 0}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {t('staking.nominateValidators')}
              </Button>
            </TabsContent>

            {/* VALIDATOR POOL TAB */}
            <TabsContent value="pool" className="space-y-4">
              <ValidatorPoolDashboard />
            </TabsContent>

            {/* UNSTAKE TAB */}
            <TabsContent value="unstake" className="space-y-4">
              <Alert className="bg-yellow-900/20 border-yellow-500">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('staking.unbondInfo', { eras: bondingDuration, days: Math.floor(bondingDuration / 4) })}
                </AlertDescription>
              </Alert>

              <div>
                <Label>{t('staking.amountToUnbond')}</Label>
                <Input
                  type="number"
                  placeholder={`Max: ${stakingInfo?.active || '0'}`}
                  value={unbondAmount}
                  onChange={(e) => setUnbondAmount(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                  disabled={isLoading}
                />
                <div className="flex justify-between mt-1 text-xs text-gray-400">
                  <span>{t('staking.staked', { amount: stakingInfo?.active || '0' })}</span>
                  <button
                    onClick={() => setUnbondAmount(stakingInfo?.active || '0')}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    {t('staking.max')}
                  </button>
                </div>
              </div>

              {stakingInfo && stakingInfo.unlocking.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                  <Label className="text-sm">{t('staking.unlockingChunks')}</Label>
                  {stakingInfo.unlocking.map((chunk, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-400">{chunk.amount} HEZ</span>
                      <span className="text-gray-500">
                        {t('staking.eraInfo', { era: chunk.era })} ({chunk.blocksRemaining > 0 ? t('staking.blocksRemaining', { blocks: Math.floor(chunk.blocksRemaining / 600) }) : t('staking.ready')})
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={handleUnbond}
                disabled={isLoading || !unbondAmount || !stakingInfo || parseFloat(stakingInfo.active) === 0}
                className="w-full bg-red-600 hover:bg-red-700"
                variant="destructive"
              >
                {t('staking.unbondTokens')}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
