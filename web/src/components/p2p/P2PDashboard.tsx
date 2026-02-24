import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PlusCircle, Home, ClipboardList, TrendingUp, CheckCircle2, Clock, Store, Zap, Blocks, MessageSquare } from 'lucide-react';
import { AdList } from './AdList';
import { CreateAd } from './CreateAd';
import { NotificationBell } from './NotificationBell';
import { QuickFilterBar } from './OrderFilters';
import { InternalBalanceCard } from './InternalBalanceCard';
import { DepositModal } from './DepositModal';
import { WithdrawModal } from './WithdrawModal';
import { ExpressMode } from './ExpressMode';
import { BlockTrade } from './BlockTrade';
import { DEFAULT_FILTERS, type P2PFilters } from './types';
import { useP2PIdentity } from '@/contexts/P2PIdentityContext';
import { supabase } from '@/lib/supabase';

interface UserStats {
  activeTrades: number;
  completedTrades: number;
  totalVolume: number;
}

export function P2PDashboard() {
  const { t } = useTranslation();
  const [showCreateAd, setShowCreateAd] = useState(false);
  const [userStats, setUserStats] = useState<UserStats>({ activeTrades: 0, completedTrades: 0, totalVolume: 0 });
  const [filters, setFilters] = useState<P2PFilters>(DEFAULT_FILTERS);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0);
  const navigate = useNavigate();
  const { userId } = useP2PIdentity();

  const [unreadMessages, setUnreadMessages] = useState(0);

  const handleBalanceUpdated = () => {
    setBalanceRefreshKey(prev => prev + 1);
  };

  // Fetch unread message count
  useEffect(() => {
    const fetchUnread = async () => {
      if (!userId) return;

      try {
        // Get all trade IDs where user is participant
        const { data: trades } = await supabase
          .from('p2p_fiat_trades')
          .select('id')
          .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`);

        if (!trades || trades.length === 0) return;

        const tradeIds = trades.map(t => t.id);

        const { count } = await supabase
          .from('p2p_messages')
          .select('*', { count: 'exact', head: true })
          .in('trade_id', tradeIds)
          .neq('sender_id', userId)
          .eq('is_read', false);

        setUnreadMessages(count || 0);
      } catch (error) {
        console.error('Fetch unread count error:', error);
      }
    };

    fetchUnread();

    // Realtime subscription for new messages
    const channel = supabase
      .channel('p2p-unread-count')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'p2p_messages',
        },
        () => {
          fetchUnread();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'p2p_messages',
        },
        () => {
          fetchUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Fetch user stats
  useEffect(() => {
    const fetchStats = async () => {
      if (!userId) return;

      try {
        // Count active trades
        const { count: activeCount } = await supabase
          .from('p2p_fiat_trades')
          .select('*', { count: 'exact', head: true })
          .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`)
          .in('status', ['pending', 'payment_sent']);

        // Count completed trades
        const { count: completedCount } = await supabase
          .from('p2p_fiat_trades')
          .select('*', { count: 'exact', head: true })
          .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`)
          .eq('status', 'completed');

        // Calculate total volume
        const { data: trades } = await supabase
          .from('p2p_fiat_trades')
          .select('fiat_amount')
          .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`)
          .eq('status', 'completed');

        const totalVolume = trades?.reduce((sum, t) => sum + (t.fiat_amount || 0), 0) || 0;

        setUserStats({
          activeTrades: activeCount || 0,
          completedTrades: completedCount || 0,
          totalVolume,
        });
      } catch (error) {
        console.error('Fetch stats error:', error);
      }
    };

    fetchStats();
  }, [userId]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-white"
        >
          <Home className="w-4 h-4 mr-2" />
          {t('p2p.backToHome')}
        </Button>
        <div className="flex items-center gap-1 sm:gap-3">
          <NotificationBell />
          <button
            onClick={() => navigate('/p2p/orders')}
            className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg hover:bg-gray-800/60 transition-colors"
          >
            <ClipboardList className="w-5 h-5 text-gray-300" />
            <span className="text-[10px] text-gray-400">{t('p2pNav.orders')}</span>
            {userStats.activeTrades > 0 && (
              <Badge className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[10px] px-1.5 min-w-[18px] h-[18px] flex items-center justify-center">
                {userStats.activeTrades}
              </Badge>
            )}
          </button>
          <button
            onClick={() => navigate('/p2p/merchant')}
            className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg hover:bg-gray-800/60 transition-colors"
          >
            <Store className="w-5 h-5 text-gray-300" />
            <span className="text-[10px] text-gray-400">{t('p2pNav.ads')}</span>
          </button>
          <button
            onClick={() => navigate('/p2p/messages')}
            className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg hover:bg-gray-800/60 transition-colors"
          >
            <MessageSquare className="w-5 h-5 text-gray-300" />
            <span className="text-[10px] text-gray-400">{t('p2pNav.messages')}</span>
            {unreadMessages > 0 && (
              <Badge className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] px-1.5 min-w-[18px] h-[18px] flex items-center justify-center">
                {unreadMessages}
              </Badge>
            )}
          </button>
        </div>
      </div>

      {/* Stats Cards and Balance Card */}
      {userId && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          {/* Internal Balance Card - Takes more space */}
          <div className="lg:col-span-1">
            <InternalBalanceCard
              key={balanceRefreshKey}
              onDeposit={() => setShowDepositModal(true)}
              onWithdraw={() => setShowWithdrawModal(true)}
            />
          </div>

          {/* Stats Cards - Compact on mobile */}
          <div className="lg:col-span-3 grid grid-cols-3 gap-2 md:hidden">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex flex-col items-center text-center">
              <Clock className="w-4 h-4 text-yellow-400 mb-1" />
              <span className="text-[10px] text-gray-400">{t('p2p.activeTrades')}</span>
              <span className="text-lg font-bold text-white">{userStats.activeTrades}</span>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex flex-col items-center text-center">
              <CheckCircle2 className="w-4 h-4 text-green-400 mb-1" />
              <span className="text-[10px] text-gray-400">{t('p2p.completed')}</span>
              <span className="text-lg font-bold text-white">{userStats.completedTrades}</span>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex flex-col items-center text-center">
              <TrendingUp className="w-4 h-4 text-blue-400 mb-1" />
              <span className="text-[10px] text-gray-400">{t('p2p.volume')}</span>
              <span className="text-lg font-bold text-white">${userStats.totalVolume.toLocaleString()}</span>
            </div>
          </div>
          {/* Stats Cards - Desktop */}
          <div className="lg:col-span-3 hidden md:grid grid-cols-3 gap-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="py-4 flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Clock className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{userStats.activeTrades}</p>
                  <p className="text-sm text-gray-400">{t('p2p.activeTrades')}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="py-4 flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{userStats.completedTrades}</p>
                  <p className="text-sm text-gray-400">{t('p2p.completed')}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="py-4 flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">${userStats.totalVolume.toLocaleString()}</p>
                  <p className="text-sm text-gray-400">{t('p2p.volume')}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white">{t('p2p.title')}</h1>
          <p className="text-gray-400 text-sm sm:text-base">{t('p2p.subtitle')}</p>
        </div>
        <Button onClick={() => setShowCreateAd(true)} className="w-full sm:w-auto">
          <PlusCircle className="w-4 h-4 mr-2" />
          {t('p2p.postNewAd')}
        </Button>
      </div>

      {showCreateAd ? (
        <CreateAd onAdCreated={() => setShowCreateAd(false)} />
      ) : (
        <>
          {/* Quick Filter Bar */}
          <QuickFilterBar filters={filters} onFiltersChange={setFilters} />

          <Tabs defaultValue="buy">
            <TabsList className="grid w-full grid-cols-5 overflow-x-auto scrollbar-hide">
              <TabsTrigger value="express" className="flex items-center gap-1 text-xs sm:text-sm px-1 sm:px-3">
                <Zap className="w-3 h-3" />
                <span className="hidden xs:inline">{t('p2p.tabExpress')}</span>
              </TabsTrigger>
              <TabsTrigger value="buy" className="text-xs sm:text-sm px-1 sm:px-3">{t('p2p.tabBuy')}</TabsTrigger>
              <TabsTrigger value="sell" className="text-xs sm:text-sm px-1 sm:px-3">{t('p2p.tabSell')}</TabsTrigger>
              <TabsTrigger value="my-ads" className="text-xs sm:text-sm px-1 sm:px-3">{t('p2p.tabMyAds')}</TabsTrigger>
              <TabsTrigger value="otc" className="flex items-center gap-1 text-xs sm:text-sm px-1 sm:px-3">
                <Blocks className="w-3 h-3" />
                <span className="hidden xs:inline">{t('p2p.tabOtc')}</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="express">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                <ExpressMode onTradeStarted={(id) => navigate(`/p2p/trade/${id}`)} />
                <div className="space-y-4">
                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="pt-6">
                      <h3 className="text-lg font-semibold text-white mb-2">{t('p2p.whyExpress')}</h3>
                      <ul className="space-y-2 text-sm text-gray-400">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                          {t('p2p.instantMatching')}
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                          {t('p2p.verifiedMerchantsOnly')}
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                          {t('p2p.escrowProtection')}
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                          {t('p2p.noManualSelection')}
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="buy">
              <AdList type="buy" filters={filters} />
            </TabsContent>
            <TabsContent value="sell">
              <AdList type="sell" filters={filters} />
            </TabsContent>
            <TabsContent value="my-ads">
              <AdList type="my-ads" filters={filters} />
            </TabsContent>
            <TabsContent value="otc">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                <BlockTrade />
                <div className="space-y-4">
                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="pt-6">
                      <h3 className="text-lg font-semibold text-white mb-2">{t('p2p.blockTradeBenefits')}</h3>
                      <ul className="space-y-2 text-sm text-gray-400">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-purple-400" />
                          {t('p2p.customPricing')}
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-purple-400" />
                          {t('p2p.dedicatedSupport')}
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-purple-400" />
                          {t('p2p.multiTranche')}
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-purple-400" />
                          {t('p2p.enhancedPrivacy')}
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-purple-400" />
                          {t('p2p.flexiblePayment')}
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Deposit Modal */}
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onSuccess={handleBalanceUpdated}
      />

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        onSuccess={handleBalanceUpdated}
      />
    </div>
  );
}
