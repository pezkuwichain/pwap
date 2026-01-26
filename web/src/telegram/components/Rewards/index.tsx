import { useState, useEffect } from 'react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useReferral } from '@/contexts/ReferralContext';
import { useWallet } from '@/contexts/WalletContext';
import { useTelegram } from '../../hooks/useTelegram';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getReferralStats, ReferralStats, getMyReferrals, calculateReferralScore } from '@shared/lib/referral';
import { getStakingInfo, StakingInfo } from '@shared/lib/staking';
import {
  Gift, Users, Trophy, Copy, Check, Share2, Loader2, RefreshCw,
  UserPlus, Award, Star, Calendar, Zap, ChevronRight, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function RewardsSection() {
  const { api, isApiReady, selectedAccount } = usePezkuwi();
  const { stats, myReferrals, loading: referralLoading, refreshStats } = useReferral();
  const { isConnected } = useWallet();
  const { hapticNotification, hapticImpact, showAlert, openTelegramLink } = useTelegram();

  const [stakingInfo, setStakingInfo] = useState<StakingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const address = selectedAccount?.address;
  const referralLink = address ? `https://t.me/pezkuwichain_bot?start=${address}` : '';

  // Fetch staking data
  useEffect(() => {
    if (!api || !isApiReady || !address) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const staking = await getStakingInfo(api, address);
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
      showAlert('Link kopyalanamadı');
    }
  };

  const handleShare = () => {
    if (!referralLink) return;
    hapticImpact('medium');
    const text = encodeURIComponent('Pezkuwichain - Kürt Dijital Devleti! Referans linkimle katıl:');
    openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${text}`);
  };

  const handleRefresh = async () => {
    hapticNotification('success');
    await refreshStats();
  };

  // Not connected state
  if (!isConnected || !selectedAccount) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-6">
            <Gift className="w-12 h-12 text-purple-500" />
          </div>
          <h2 className="text-white font-semibold text-xl mb-2">Ödüller ve Referanslar</h2>
          <p className="text-gray-400 text-sm text-center mb-8 max-w-xs">
            Referans programına katılmak ve ödüllerinizi görmek için cüzdanınızı bağlayın.
          </p>
          <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
            <div className="flex flex-col items-center p-3 bg-gray-900 rounded-lg">
              <UserPlus className="w-6 h-6 text-green-500 mb-2" />
              <span className="text-xs text-gray-400 text-center">Arkadaş Davet</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-gray-900 rounded-lg">
              <Trophy className="w-6 h-6 text-yellow-500 mb-2" />
              <span className="text-xs text-gray-400 text-center">Puan Kazan</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-gray-900 rounded-lg">
              <Zap className="w-6 h-6 text-orange-500 mb-2" />
              <span className="text-xs text-gray-400 text-center">PEZ Ödülü</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-950">
      {/* Header Stats */}
      <div className="p-4 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-500" />
            Ödüller
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={referralLoading}
            className="h-8 w-8"
          >
            <RefreshCw className={cn("w-4 h-4 text-gray-400", referralLoading && "animate-spin")} />
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 text-center">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-2">
                <Users className="w-5 h-5 text-green-500" />
              </div>
              {referralLoading ? (
                <Skeleton className="h-6 w-8 mx-auto bg-gray-700" />
              ) : (
                <p className="text-white text-xl font-bold">{stats?.referralCount || 0}</p>
              )}
              <p className="text-gray-500 text-xs">Referans</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 text-center">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
              </div>
              {referralLoading ? (
                <Skeleton className="h-6 w-8 mx-auto bg-gray-700" />
              ) : (
                <p className="text-white text-xl font-bold">{stats?.referralScore || 0}</p>
              )}
              <p className="text-gray-500 text-xs">Puan</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 text-center">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
                <Award className="w-5 h-5 text-blue-500" />
              </div>
              {isLoading ? (
                <Skeleton className="h-6 w-8 mx-auto bg-gray-700" />
              ) : (
                <p className="text-white text-xl font-bold">{stakingInfo?.stakingScore || 0}</p>
              )}
              <p className="text-gray-500 text-xs">Staking</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Referral Invite Section */}
      <div className="px-4 pb-4">
        <Card className="bg-gradient-to-br from-purple-600 to-pink-600 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Arkadaşını Davet Et</h3>
                <p className="text-purple-100 text-sm">Her referans için puan kazan!</p>
              </div>
            </div>

            {/* Referral Link */}
            <div className="bg-black/20 rounded-lg p-3 mb-3">
              <p className="text-purple-200 text-xs mb-1">Referans Linkin</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-white text-xs truncate">{referralLink}</code>
                <button
                  onClick={handleCopyLink}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>
            </div>

            <Button
              onClick={handleShare}
              className="w-full bg-white text-purple-600 hover:bg-purple-50"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Telegram'da Paylaş
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Score System Info */}
      <div className="px-4 pb-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              Puan Sistemi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs">1-10 referans</span>
              </div>
              <span className="text-green-400 text-sm font-medium">×10 puan</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs">11-50 referans</span>
              </div>
              <span className="text-green-400 text-sm font-medium">100 + ×5 puan</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs">51-100 referans</span>
              </div>
              <span className="text-green-400 text-sm font-medium">300 + ×4 puan</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs">101+ referans</span>
              </div>
              <span className="text-yellow-400 text-sm font-medium">500 (Max)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Epoch Rewards */}
      {stakingInfo?.pezRewards?.hasPendingClaim && (
        <div className="px-4 pb-4">
          <Card className="bg-gradient-to-br from-orange-600 to-yellow-600 border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-white" />
                  <span className="text-white font-medium">Epoch Ödülleri</span>
                </div>
                <Badge className="bg-white/20 text-white border-0">
                  Epoch #{stakingInfo.pezRewards.currentEpoch}
                </Badge>
              </div>

              <div className="bg-black/20 rounded-lg p-3 mb-3">
                <p className="text-orange-100 text-xs mb-1">Bekleyen PEZ</p>
                <p className="text-white text-2xl font-bold">
                  {stakingInfo.pezRewards.totalClaimable} PEZ
                </p>
              </div>

              <div className="space-y-2 mb-3">
                {stakingInfo.pezRewards.claimableRewards.map((reward) => (
                  <div key={reward.epoch} className="flex items-center justify-between bg-black/10 rounded-lg p-2">
                    <span className="text-orange-100 text-sm">Epoch #{reward.epoch}</span>
                    <span className="text-white font-medium">{reward.amount} PEZ</span>
                  </div>
                ))}
              </div>

              <Button
                className="w-full bg-white text-orange-600 hover:bg-orange-50"
                onClick={() => showAlert('Claim özelliği yakında!')}
              >
                <Zap className="w-4 h-4 mr-2" />
                Tümünü Claim Et
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* My Referrals List */}
      {myReferrals && myReferrals.length > 0 && (
        <div className="px-4 pb-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-green-500" />
                Referanslarım ({myReferrals.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {myReferrals.slice(0, 5).map((referral, index) => (
                <div key={referral} className="flex items-center justify-between p-2 bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                      <span className="text-green-500 text-xs font-bold">{index + 1}</span>
                    </div>
                    <code className="text-gray-300 text-xs">
                      {referral.slice(0, 6)}...{referral.slice(-4)}
                    </code>
                  </div>
                  <Badge variant="outline" className="text-green-400 border-green-500/30 text-xs">
                    KYC Onaylı
                  </Badge>
                </div>
              ))}
              {myReferrals.length > 5 && (
                <p className="text-gray-500 text-xs text-center pt-2">
                  +{myReferrals.length - 5} daha fazla
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Who invited me */}
      {stats?.whoInvitedMe && (
        <div className="px-4 pb-6">
          <Alert className="bg-blue-500/10 border-blue-500/30">
            <Award className="w-4 h-4 text-blue-500" />
            <AlertDescription className="text-blue-200 text-sm">
              <span className="text-gray-400">Davet eden: </span>
              <code className="text-blue-300">
                {stats.whoInvitedMe.slice(0, 8)}...{stats.whoInvitedMe.slice(-6)}
              </code>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}

export default RewardsSection;
