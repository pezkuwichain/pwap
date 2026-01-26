import { useState, useEffect } from 'react';
import { Gift, Users, Trophy, Calendar, Copy, Check, Share2, Loader2, Star } from 'lucide-react';
import { useTelegram } from '../../hooks/useTelegram';
import { usePezkuwiApi } from '../../hooks/usePezkuwiApi';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { getReferralStats, calculateReferralScore, ReferralStats } from '@shared/lib/referral';
import { getAllScores, UserScores, getScoreRating, getScoreColor } from '@shared/lib/scores';
import { getStakingInfo, StakingInfo } from '@shared/lib/staking';
import { cn } from '@/lib/utils';

interface DailyTask {
  id: string;
  title: string;
  description: string;
  reward: number;
  completed: boolean;
  progress?: number;
  maxProgress?: number;
}

const dailyTasks: DailyTask[] = [
  {
    id: 'login',
    title: 'Daily Login',
    description: 'Open the app daily',
    reward: 5,
    completed: true,
  },
  {
    id: 'forum',
    title: 'Forum Activity',
    description: 'Post or reply in forum',
    reward: 10,
    completed: false,
  },
  {
    id: 'referral',
    title: 'Invite a Friend',
    description: 'Invite a new user to join',
    reward: 50,
    completed: false,
  },
];

export function Rewards() {
  const { hapticNotification, hapticImpact, showAlert, user, openTelegramLink } = useTelegram();
  const { api, isReady: isApiReady } = usePezkuwiApi();
  const { selectedAccount } = usePezkuwi();

  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [userScores, setUserScores] = useState<UserScores | null>(null);
  const [stakingInfo, setStakingInfo] = useState<StakingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [claimingEpoch, setClaimingEpoch] = useState<number | null>(null);

  const isConnected = !!selectedAccount;
  const address = selectedAccount?.address;

  // Generate referral link
  const referralLink = address
    ? `https://t.me/pezkuwichain?start=${address}`
    : '';

  // Fetch data when connected
  useEffect(() => {
    if (!api || !isApiReady || !address) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [stats, scores, staking] = await Promise.all([
          getReferralStats(api, address),
          getAllScores(api, address),
          getStakingInfo(api, address),
        ]);

        setReferralStats(stats);
        setUserScores(scores);
        setStakingInfo(staking);
      } catch (err) {
        console.error('Failed to fetch rewards data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [api, isApiReady, address]);

  const handleCopyLink = async () => {
    if (!referralLink) return;

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      hapticNotification('success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showAlert('Failed to copy link');
    }
  };

  const handleShare = () => {
    if (!referralLink) return;

    hapticImpact('medium');
    const text = `Join Pezkuwichain - The Digital Kurdish State! Use my referral link:`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`;
    openTelegramLink(shareUrl);
  };

  const handleClaimEpoch = async (epoch: number) => {
    if (!api || !selectedAccount) return;

    setClaimingEpoch(epoch);
    hapticImpact('medium');

    try {
      // TODO: Implement actual claim transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      hapticNotification('success');
      showAlert(`Successfully claimed rewards for epoch ${epoch}!`);
    } catch (err) {
      hapticNotification('error');
      showAlert('Failed to claim rewards');
    } finally {
      setClaimingEpoch(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 p-4 border-b border-gray-800">
          <Gift className="w-5 h-5 text-green-500" />
          <h2 className="text-lg font-semibold text-white">Rewards</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-6">
          <Gift className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-center mb-4">Connect your wallet to view rewards and referrals</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-gray-800">
        <Gift className="w-5 h-5 text-green-500" />
        <h2 className="text-lg font-semibold text-white">Rewards</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Score Overview */}
            {userScores && (
              <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <span className="text-white font-medium">Trust Score</span>
                  </div>
                  <span className={cn('text-sm font-medium', getScoreColor(userScores.totalScore))}>
                    {getScoreRating(userScores.totalScore)}
                  </span>
                </div>
                <div className="text-4xl font-bold text-white mb-2">
                  {userScores.totalScore}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-black/20 rounded px-2 py-1">
                    <span className="text-green-200">Staking:</span>{' '}
                    <span className="text-white">{userScores.stakingScore}</span>
                  </div>
                  <div className="bg-black/20 rounded px-2 py-1">
                    <span className="text-green-200">Referral:</span>{' '}
                    <span className="text-white">{userScores.referralScore}</span>
                  </div>
                  <div className="bg-black/20 rounded px-2 py-1">
                    <span className="text-green-200">Tiki:</span>{' '}
                    <span className="text-white">{userScores.tikiScore}</span>
                  </div>
                  <div className="bg-black/20 rounded px-2 py-1">
                    <span className="text-green-200">Trust:</span>{' '}
                    <span className="text-white">{userScores.trustScore}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Referral Section */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-green-500" />
                <span className="text-white font-medium">Referral Program</span>
              </div>

              {referralStats && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-900 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-white">
                      {referralStats.referralCount}
                    </div>
                    <div className="text-xs text-gray-400">Referrals</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-500">
                      {referralStats.referralScore}
                    </div>
                    <div className="text-xs text-gray-400">Score</div>
                  </div>
                </div>
              )}

              {/* Referral link */}
              <div className="bg-gray-900 rounded-lg p-3 mb-3">
                <div className="text-xs text-gray-400 mb-1">Your referral link</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm text-gray-300 truncate">
                    {referralLink}
                  </code>
                  <button
                    onClick={handleCopyLink}
                    className="p-2 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share via Telegram
              </button>

              {/* Who invited me */}
              {referralStats?.whoInvitedMe && (
                <div className="mt-3 text-sm text-gray-400">
                  Invited by:{' '}
                  <span className="text-gray-300">
                    {referralStats.whoInvitedMe.slice(0, 8)}...{referralStats.whoInvitedMe.slice(-6)}
                  </span>
                </div>
              )}
            </div>

            {/* Epoch Rewards */}
            {stakingInfo?.pezRewards && stakingInfo.pezRewards.hasPendingClaim && (
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-5 h-5 text-green-500" />
                  <span className="text-white font-medium">Epoch Rewards</span>
                </div>

                <div className="bg-gray-900 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Current Epoch</span>
                    <span className="text-white font-medium">
                      #{stakingInfo.pezRewards.currentEpoch}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Claimable</span>
                    <span className="text-green-500 font-bold">
                      {stakingInfo.pezRewards.totalClaimable} PEZ
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {stakingInfo.pezRewards.claimableRewards.map(reward => (
                    <div
                      key={reward.epoch}
                      className="flex items-center justify-between bg-gray-900 rounded-lg p-3"
                    >
                      <div>
                        <div className="text-sm text-white">Epoch #{reward.epoch}</div>
                        <div className="text-xs text-green-500">{reward.amount} PEZ</div>
                      </div>
                      <button
                        onClick={() => handleClaimEpoch(reward.epoch)}
                        disabled={claimingEpoch === reward.epoch}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white text-sm rounded-lg transition-colors"
                      >
                        {claimingEpoch === reward.epoch ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Claim'
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily Tasks */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-5 h-5 text-yellow-500" />
                <span className="text-white font-medium">Daily Tasks</span>
              </div>

              <div className="space-y-3">
                {dailyTasks.map(task => (
                  <div
                    key={task.id}
                    className={cn(
                      'bg-gray-900 rounded-lg p-3 flex items-center justify-between',
                      task.completed && 'opacity-60'
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'text-sm font-medium',
                          task.completed ? 'text-gray-400 line-through' : 'text-white'
                        )}>
                          {task.title}
                        </span>
                        {task.completed && (
                          <Check className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{task.description}</div>
                    </div>
                    <div className="text-sm font-medium text-yellow-500">
                      +{task.reward} pts
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Rewards;
