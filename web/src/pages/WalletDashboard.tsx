import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { AccountBalance } from '@/components/AccountBalance';
import { TransferModal } from '@/components/TransferModal';
import { ReceiveModal } from '@/components/ReceiveModal';
import { TransactionHistory } from '@/components/TransactionHistory';
import { NftList } from '@/components/NftList';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, ArrowDownRight, History, ArrowLeft, RefreshCw, Coins, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSigner } from '@/lib/get-signer';
import { getPezRewards, recordTrustScore, claimPezReward, type PezRewardInfo } from '@pezkuwi/lib/scores';

interface Transaction {
  blockNumber: number;
  extrinsicIndex: number;
  hash: string;
  method: string;
  section: string;
  from: string;
  to?: string;
  amount?: string;
  success: boolean;
  timestamp?: number;
}

const WalletDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { api, isApiReady, peopleApi, isPeopleReady, selectedAccount, walletSource } = usePezkuwi();
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [pezRewards, setPezRewards] = useState<PezRewardInfo | null>(null);
  const [isRecordingScore, setIsRecordingScore] = useState(false);
  const [isClaimingReward, setIsClaimingReward] = useState(false);

  // Fetch recent transactions (limited to last 10 blocks for performance)
  const fetchRecentTransactions = async () => {
    if (!api || !isApiReady || !selectedAccount) return;

    setIsLoadingRecent(true);
    try {
      const currentBlock = await api.rpc.chain.getBlock();
      const currentBlockNumber = currentBlock.block.header.number.toNumber();

      const txList: Transaction[] = [];
      // Only check last 10 blocks for performance (proper indexer needed for full history)
      const blocksToCheck = Math.min(10, currentBlockNumber);

      for (let i = 0; i < blocksToCheck && txList.length < 5; i++) {
        const blockNumber = currentBlockNumber - i;

        try {
          const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
          const block = await api.rpc.chain.getBlock(blockHash);

          let timestamp = 0;
          try {
            const ts = await api.query.timestamp.now.at(blockHash);
            timestamp = ts.toNumber();
          } catch {
            timestamp = Date.now();
          }

          block.block.extrinsics.forEach((extrinsic, index) => {
            if (!extrinsic.isSigned) return;

            const { method, signer } = extrinsic;
            const fromAddress = signer.toString();
            const isFromOurAccount = fromAddress === selectedAccount.address;

            // Only track this account's transactions
            if (!isFromOurAccount) return;

            // Parse balances.transfer
            if (method.section === 'balances' &&
                (method.method === 'transfer' || method.method === 'transferKeepAlive')) {
              const [dest, value] = method.args;
              txList.push({
                blockNumber,
                extrinsicIndex: index,
                hash: extrinsic.hash.toHex(),
                method: method.method,
                section: method.section,
                from: fromAddress,
                to: dest.toString(),
                amount: value.toString(),
                success: true,
                timestamp: timestamp,
              });
            }

            // Parse assets.transfer
            else if (method.section === 'assets' && method.method === 'transfer') {
              const [assetId, dest, value] = method.args;
              txList.push({
                blockNumber,
                extrinsicIndex: index,
                hash: extrinsic.hash.toHex(),
                method: `${method.method} (Asset ${assetId.toString()})`,
                section: method.section,
                from: fromAddress,
                to: dest.toString(),
                amount: value.toString(),
                success: true,
                timestamp: timestamp,
              });
            }

            // Parse staking operations
            else if (method.section === 'staking') {
              if (method.method === 'bond' || method.method === 'bondExtra') {
                const value = method.args[method.method === 'bond' ? 1 : 0];
                txList.push({
                  blockNumber,
                  extrinsicIndex: index,
                  hash: extrinsic.hash.toHex(),
                  method: method.method,
                  section: method.section,
                  from: fromAddress,
                  amount: value.toString(),
                  success: true,
                  timestamp: timestamp,
                });
              } else if (method.method === 'unbond') {
                const [value] = method.args;
                txList.push({
                  blockNumber,
                  extrinsicIndex: index,
                  hash: extrinsic.hash.toHex(),
                  method: method.method,
                  section: method.section,
                  from: fromAddress,
                  amount: value.toString(),
                  success: true,
                  timestamp: timestamp,
                });
              } else if (method.method === 'nominate' || method.method === 'withdrawUnbonded' || method.method === 'chill') {
                txList.push({
                  blockNumber,
                  extrinsicIndex: index,
                  hash: extrinsic.hash.toHex(),
                  method: method.method,
                  section: method.section,
                  from: fromAddress,
                  success: true,
                  timestamp: timestamp,
                });
              }
            }

            // Parse DEX operations
            else if (method.section === 'dex') {
              if (method.method === 'swap') {
                const [, amountIn] = method.args;
                txList.push({
                  blockNumber,
                  extrinsicIndex: index,
                  hash: extrinsic.hash.toHex(),
                  method: method.method,
                  section: method.section,
                  from: fromAddress,
                  amount: amountIn.toString(),
                  success: true,
                  timestamp: timestamp,
                });
              } else if (method.method === 'addLiquidity' || method.method === 'removeLiquidity') {
                txList.push({
                  blockNumber,
                  extrinsicIndex: index,
                  hash: extrinsic.hash.toHex(),
                  method: method.method,
                  section: method.section,
                  from: fromAddress,
                  success: true,
                  timestamp: timestamp,
                });
              }
            }

            // Parse stakingScore & pezRewards
            else if ((method.section === 'stakingScore' && method.method === 'startTracking') ||
                     (method.section === 'pezRewards' && (method.method === 'claimReward' || method.method === 'recordTrustScore'))) {
              txList.push({
                blockNumber,
                extrinsicIndex: index,
                hash: extrinsic.hash.toHex(),
                method: method.method,
                section: method.section,
                from: fromAddress,
                success: true,
                timestamp: timestamp,
              });
            }
          });
        } catch {
          // Continue to next block
        }
      }

      setRecentTransactions(txList);
    } catch (error) {
      console.error('Failed to fetch recent transactions:', error);
    } finally {
      setIsLoadingRecent(false);
    }
  };

  useEffect(() => {
    if (selectedAccount && api && isApiReady) {
      fetchRecentTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount, api, isApiReady]);

  // Fetch PEZ rewards from People Chain
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
      const injector = await getSigner(selectedAccount.address, walletSource, peopleApi);
      const result = await recordTrustScore(peopleApi, selectedAccount.address, injector.signer);
      if (result.success) {
        toast.success(t('wallet.trustScoreRecorded'));
        const rewards = await getPezRewards(peopleApi, selectedAccount.address);
        setPezRewards(rewards);
      } else {
        toast.error(result.error || t('wallet.failedToRecordScore'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('wallet.failedToRecordScore'));
    } finally {
      setIsRecordingScore(false);
    }
  };

  const handleClaimReward = async (epochIndex: number) => {
    if (!peopleApi || !selectedAccount) return;
    setIsClaimingReward(true);
    try {
      const injector = await getSigner(selectedAccount.address, walletSource, peopleApi);
      const result = await claimPezReward(peopleApi, selectedAccount.address, epochIndex, injector.signer);
      if (result.success) {
        const rewardInfo = pezRewards?.claimableRewards.find(r => r.epoch === epochIndex);
        toast.success(t('wallet.rewardClaimed', { amount: rewardInfo?.amount || '0' }));
        const rewards = await getPezRewards(peopleApi, selectedAccount.address);
        setPezRewards(rewards);
      } else {
        toast.error(result.error || t('wallet.failedToClaimReward'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('wallet.failedToClaimReward'));
    } finally {
      setIsClaimingReward(false);
    }
  };

  const formatAmount = (amount: string, decimals: number = 12) => {
    const value = parseInt(amount) / Math.pow(10, decimals);
    return value.toFixed(4);
  };

  const isIncoming = (tx: Transaction) => {
    return tx.to === selectedAccount?.address;
  };

  if (!selectedAccount) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">{t('wallet.notConnected')}</h2>
          <p className="text-gray-400 mb-6">{t('wallet.connectToView')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">{t('wallet.dashboard')}</h1>
            <p className="text-gray-400">{t('wallet.manageTokens')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Recent Activity & NFTs (hidden on mobile) */}
          <div className="hidden md:block lg:col-span-1 space-y-6">
            {/* Recent Activity */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{t('wallet.recentActivity')}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={fetchRecentTransactions}
                  disabled={isLoadingRecent}
                  className="text-gray-400 hover:text-white"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingRecent ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {isLoadingRecent ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-10 h-10 text-gray-600 mx-auto mb-3 animate-spin" />
                  <p className="text-gray-400 text-sm">{t('wallet.loading')}</p>
                </div>
              ) : recentTransactions.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">{t('wallet.noRecentTx')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentTransactions.slice(0, 5).map((tx) => (
                    <div
                      key={`${tx.blockNumber}-${tx.extrinsicIndex}`}
                      className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isIncoming(tx) ? (
                            <div className="bg-green-500/20 p-1.5 rounded-lg">
                              <ArrowDownRight className="w-3 h-3 text-green-400" />
                            </div>
                          ) : (
                            <div className="bg-yellow-500/20 p-1.5 rounded-lg">
                              <ArrowUpRight className="w-3 h-3 text-yellow-400" />
                            </div>
                          )}
                          <div>
                            <div className="text-white font-semibold text-xs">
                              {isIncoming(tx) ? t('wallet.received') : t('wallet.sent')}
                            </div>
                            <div className="text-xs text-gray-500">
                              #{tx.blockNumber}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-mono text-xs">
                            {isIncoming(tx) ? '+' : '-'}{formatAmount(tx.amount || '0')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={() => setIsHistoryModalOpen(true)}
                variant="outline"
                size="sm"
                className="mt-3 w-full border-gray-700 hover:bg-gray-800 text-xs"
              >
                {t('wallet.viewAll')}
              </Button>
            </div>

            {/* NFT Collection */}
            <NftList />
          </div>

          {/* Right Column - Actions & Tokens */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-4">
              <Button
                onClick={() => setIsTransferModalOpen(true)}
                className="bg-gradient-to-r from-green-600 to-yellow-400 hover:from-green-700 hover:to-yellow-500 h-24 flex flex-col items-center justify-center"
              >
                <ArrowUpRight className="w-6 h-6 mb-2" />
                <span>{t('wallet.send')}</span>
              </Button>

              <Button
                onClick={() => setIsReceiveModalOpen(true)}
                variant="outline"
                className="border-gray-700 hover:bg-gray-800 h-24 flex flex-col items-center justify-center"
              >
                <ArrowDownRight className="w-6 h-6 mb-2" />
                <span>{t('wallet.receive')}</span>
              </Button>

              <Button
                onClick={() => setIsHistoryModalOpen(true)}
                variant="outline"
                className="border-gray-700 hover:bg-gray-800 h-24 flex flex-col items-center justify-center"
              >
                <History className="w-6 h-6 mb-2" />
                <span>{t('wallet.history')}</span>
              </Button>
            </div>

            {/* PEZ Rewards Card */}
            {pezRewards && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-orange-500" />
                    <h3 className="text-lg font-semibold text-white">{t('wallet.pezRewards')}</h3>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    pezRewards.epochStatus === 'Open'
                      ? 'bg-green-500/20 text-green-400'
                      : pezRewards.epochStatus === 'ClaimPeriod'
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {t('wallet.epoch', { epoch: pezRewards.currentEpoch, status: pezRewards.epochStatus === 'Open' ? t('wallet.epochOpen') : pezRewards.epochStatus === 'ClaimPeriod' ? t('wallet.epochClaimPeriod') : t('wallet.epochClosed') })}
                  </span>
                </div>

                {/* Open epoch: Record score */}
                {pezRewards.epochStatus === 'Open' && (
                  pezRewards.hasRecordedThisEpoch ? (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-green-400 font-semibold">{t('wallet.score', { score: pezRewards.userScoreCurrentEpoch })}</span>
                      <span className="text-xs text-gray-500">{t('wallet.recordedForEpoch')}</span>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleRecordTrustScore}
                      disabled={isRecordingScore}
                      className="w-full mb-3 bg-green-600 hover:bg-green-700"
                    >
                      {isRecordingScore ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          {t('wallet.recording')}
                        </>
                      ) : t('wallet.recordTrustScore')}
                    </Button>
                  )
                )}

                {/* Claimable rewards */}
                {pezRewards.hasPendingClaim ? (
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-orange-500">
                      {parseFloat(pezRewards.totalClaimable).toFixed(2)} PEZ
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{t('wallet.epochsToClaim', { count: pezRewards.claimableRewards.length })}</p>
                    {pezRewards.claimableRewards.map((reward) => (
                      <div key={reward.epoch} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
                        <span className="text-xs text-gray-400">{t('wallet.epochReward', { epoch: reward.epoch, amount: reward.amount })}</span>
                        <Button
                          size="sm"
                          onClick={() => handleClaimReward(reward.epoch)}
                          disabled={isClaimingReward}
                          className="h-6 text-xs px-3 bg-orange-600 hover:bg-orange-700"
                        >
                          {isClaimingReward ? '...' : t('wallet.claim')}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  !pezRewards.hasRecordedThisEpoch && pezRewards.epochStatus !== 'Open' && (
                    <div className="text-gray-500 text-sm">{t('wallet.noClaimableRewards')}</div>
                  )
                )}
              </div>
            )}

            {/* Token Balances */}
            <AccountBalance />
          </div>
        </div>
      </div>

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
      />

      <ReceiveModal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
      />

      <TransactionHistory
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />
    </div>
  );
};

export default WalletDashboard;