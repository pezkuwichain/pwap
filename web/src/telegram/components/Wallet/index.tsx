import { useState, useEffect } from 'react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useWallet } from '@/contexts/WalletContext';
import { useTelegram } from '../../hooks/useTelegram';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getAllScores, UserScores, getScoreRating } from '@shared/lib/scores';
import { getStakingInfo, StakingInfo } from '@shared/lib/staking';
import { formatBalance, formatAddress, CHAIN_CONFIG } from '@shared/lib/wallet';
import {
  Wallet, Send, ArrowDownToLine, TrendingUp, Copy, Check, ExternalLink,
  Loader2, RefreshCw, Trophy, Users, Star, Award, Coins, Clock, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function WalletSection() {
  const { api, isApiReady, selectedAccount, connectWallet, disconnectWallet, accounts } = usePezkuwi();
  const { balances, refreshBalances, isConnected } = useWallet();
  const { hapticNotification, hapticImpact, showAlert, openLink } = useTelegram();

  const [scores, setScores] = useState<UserScores | null>(null);
  const [stakingInfo, setStakingInfo] = useState<StakingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const address = selectedAccount?.address;

  // Fetch data when connected
  useEffect(() => {
    if (!api || !isApiReady || !address) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [userScores, staking] = await Promise.all([
          getAllScores(api, address),
          getStakingInfo(api, address),
        ]);
        setScores(userScores);
        setStakingInfo(staking);
      } catch (err) {
        console.error('Failed to fetch wallet data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [api, isApiReady, address]);

  const handleRefresh = async () => {
    if (!api || !address || isRefreshing) return;
    setIsRefreshing(true);
    hapticNotification('success');

    try {
      await refreshBalances();
      const [userScores, staking] = await Promise.all([
        getAllScores(api, address),
        getStakingInfo(api, address),
      ]);
      setScores(userScores);
      setStakingInfo(staking);
    } catch (err) {
      showAlert('Yenileme başarısız');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      hapticNotification('success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showAlert('Adres kopyalanamadı');
    }
  };

  const handleConnect = () => {
    hapticImpact('medium');
    connectWallet();
  };

  const handleOpenExplorer = () => {
    if (!address) return;
    hapticImpact('light');
    openLink(`https://explorer.pezkuwichain.io/account/${address}`);
  };

  // Not connected state
  if (!isConnected || !selectedAccount) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mb-6">
            <Wallet className="w-12 h-12 text-cyan-500" />
          </div>
          <h2 className="text-white font-semibold text-xl mb-2">Cüzdanınızı Bağlayın</h2>
          <p className="text-gray-400 text-sm text-center mb-8 max-w-xs">
            Bakiyelerinizi görüntülemek, stake etmek ve işlem yapmak için Pezkuwi cüzdanınızı bağlayın.
          </p>
          <Button
            onClick={handleConnect}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 text-base"
          >
            <Wallet className="w-5 h-5 mr-2" />
            Cüzdan Bağla
          </Button>

          <div className="mt-8 grid grid-cols-3 gap-4 w-full max-w-sm">
            <div className="flex flex-col items-center p-3 bg-gray-900 rounded-lg">
              <Coins className="w-6 h-6 text-yellow-500 mb-2" />
              <span className="text-xs text-gray-400">HEZ & PEZ</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-gray-900 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-500 mb-2" />
              <span className="text-xs text-gray-400">Staking</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-gray-900 rounded-lg">
              <Trophy className="w-6 h-6 text-cyan-500 mb-2" />
              <span className="text-xs text-gray-400">Rewards</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-950">
      {/* Account Card */}
      <div className="p-4">
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <span className="text-white font-bold">
                    {selectedAccount?.meta?.name?.charAt(0) || 'P'}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium text-sm">
                    {selectedAccount?.meta?.name || 'Pezkuwi Hesabı'}
                  </p>
                  <div className="flex items-center gap-1">
                    <code className="text-gray-400 text-xs">
                      {formatAddress(address || '')}
                    </code>
                    <button onClick={handleCopyAddress} className="p-1">
                      {copied ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="h-8 w-8"
                >
                  <RefreshCw className={cn("w-4 h-4 text-gray-400", isRefreshing && "animate-spin")} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleOpenExplorer}
                  className="h-8 w-8"
                >
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </Button>
              </div>
            </div>

            {/* Balance Display */}
            <div className="bg-black/30 rounded-lg p-4 mb-3">
              <p className="text-gray-400 text-xs mb-1">Toplam Bakiye</p>
              {isLoading ? (
                <Skeleton className="h-8 w-32 bg-gray-700" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">
                    {balances?.HEZ || '0.00'}
                  </span>
                  <span className="text-gray-400 text-sm">{CHAIN_CONFIG.symbol}</span>
                </div>
              )}
              {balances?.PEZ && parseFloat(balances.PEZ) > 0 && (
                <p className="text-green-400 text-sm mt-1">
                  + {balances.PEZ} PEZ
                </p>
              )}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                className="flex flex-col items-center gap-1 h-auto py-3 bg-gray-800/50 border-gray-700 hover:bg-gray-700"
                onClick={() => showAlert('Gönder özelliği yakında!')}
              >
                <Send className="w-5 h-5 text-blue-400" />
                <span className="text-xs">Gönder</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center gap-1 h-auto py-3 bg-gray-800/50 border-gray-700 hover:bg-gray-700"
                onClick={() => showAlert('Al özelliği yakında!')}
              >
                <ArrowDownToLine className="w-5 h-5 text-green-400" />
                <span className="text-xs">Al</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center gap-1 h-auto py-3 bg-gray-800/50 border-gray-700 hover:bg-gray-700"
                onClick={() => showAlert('Stake özelliği yakında!')}
              >
                <TrendingUp className="w-5 h-5 text-purple-400" />
                <span className="text-xs">Stake</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scores Section */}
      <div className="px-4 pb-4">
        <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          Puanlarınız
        </h3>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 bg-gray-800" />
            ))}
          </div>
        ) : scores ? (
          <>
            {/* Total Score Banner */}
            <Card className="bg-gradient-to-r from-purple-600 to-pink-600 border-0 mb-3">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-xs">Toplam Skor</p>
                  <p className="text-white text-2xl font-bold">{scores.totalScore}</p>
                </div>
                <Badge className="bg-white/20 text-white border-0">
                  {getScoreRating(scores.totalScore)}
                </Badge>
              </CardContent>
            </Card>

            {/* Individual Scores */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Award className="w-4 h-4 text-purple-500" />
                    </div>
                    <span className="text-gray-400 text-xs">Trust</span>
                  </div>
                  <p className="text-white text-xl font-bold">{scores.trustScore}</p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <Users className="w-4 h-4 text-cyan-500" />
                    </div>
                    <span className="text-gray-400 text-xs">Referral</span>
                  </div>
                  <p className="text-white text-xl font-bold">{scores.referralScore}</p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    </div>
                    <span className="text-gray-400 text-xs">Staking</span>
                  </div>
                  <p className="text-white text-xl font-bold">{scores.stakingScore}</p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
                      <Star className="w-4 h-4 text-pink-500" />
                    </div>
                    <span className="text-gray-400 text-xs">Tiki</span>
                  </div>
                  <p className="text-white text-xl font-bold">{scores.tikiScore}</p>
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>

      {/* Staking Info */}
      {stakingInfo && parseFloat(stakingInfo.bonded) > 0 && (
        <div className="px-4 pb-4">
          <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            Staking Durumu
          </h3>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Stake Edilmiş</p>
                  <p className="text-white font-bold">{stakingInfo.bonded} HEZ</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Aktif</p>
                  <p className="text-green-400 font-bold">{stakingInfo.active} HEZ</p>
                </div>
                {stakingInfo.stakingScore !== null && (
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Staking Skoru</p>
                    <p className="text-purple-400 font-bold">{stakingInfo.stakingScore}/100</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-400 text-xs mb-1">Nominasyonlar</p>
                  <p className="text-white font-bold">{stakingInfo.nominations.length}</p>
                </div>
              </div>

              {/* PEZ Rewards */}
              {stakingInfo.pezRewards?.hasPendingClaim && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      <span className="text-gray-400 text-sm">Bekleyen PEZ</span>
                    </div>
                    <span className="text-yellow-400 font-bold">
                      {stakingInfo.pezRewards.totalClaimable} PEZ
                    </span>
                  </div>
                  <Button
                    className="w-full mt-3 bg-yellow-600 hover:bg-yellow-700"
                    onClick={() => showAlert('Claim özelliği yakında!')}
                  >
                    Claim Yap
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Disconnect Button */}
      <div className="px-4 pb-6">
        <Button
          variant="outline"
          className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
          onClick={() => {
            hapticImpact('medium');
            disconnectWallet();
          }}
        >
          Bağlantıyı Kes
        </Button>
      </div>
    </div>
  );
}

export default WalletSection;
