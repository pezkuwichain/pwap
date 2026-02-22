import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { MerchantTierBadge } from '@/components/p2p/MerchantTierBadge';
import { MerchantApplication } from '@/components/p2p/MerchantApplication';
import { CreateAd } from '@/components/p2p/CreateAd';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import {
  ArrowLeft,
  BarChart3,
  Clock,
  Crown,
  DollarSign,
  Edit,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Settings,
  ShoppingBag,
  Star,
  TrendingUp,
  Trash2
} from 'lucide-react';

// Types
interface MerchantStats {
  total_volume_30d: number;
  total_trades_30d: number;
  buy_volume_30d: number;
  sell_volume_30d: number;
  completion_rate_30d: number;
  avg_release_time_minutes: number;
  avg_payment_time_minutes: number;
  total_volume_lifetime: number;
  total_trades_lifetime: number;
}

interface ActiveAd {
  id: string;
  token: string;
  fiat_currency: string;
  amount_crypto: number;
  remaining_amount: number;
  fiat_amount: number;
  price_per_unit: number;
  status: string;
  created_at: string;
  is_featured: boolean;
  ad_type: 'buy' | 'sell';
  min_order_amount?: number;
  max_order_amount?: number;
  time_limit_minutes: number;
}

interface MerchantTier {
  tier: 'lite' | 'super' | 'diamond';
  max_pending_orders: number;
  max_order_amount: number;
  featured_ads_allowed: number;
}

interface ChartDataPoint {
  date: string;
  volume: number;
  trades: number;
}

export default function P2PMerchantDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const [tierInfo, setTierInfo] = useState<MerchantTier | null>(null);
  const [activeAds, setActiveAds] = useState<ActiveAd[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [autoReplyOpen, setAutoReplyOpen] = useState(false);
  const [autoReplyMessage, setAutoReplyMessage] = useState('');
  const [savingAutoReply, setSavingAutoReply] = useState(false);
  const [createAdOpen, setCreateAdOpen] = useState(false);

  // Edit ad state
  const [editAdOpen, setEditAdOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<ActiveAd | null>(null);
  const [editFiatAmount, setEditFiatAmount] = useState('');
  const [editMinOrder, setEditMinOrder] = useState('');
  const [editMaxOrder, setEditMaxOrder] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Fetch merchant data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Fetch stats
      const { data: statsData } = await supabase
        .from('p2p_merchant_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (statsData) {
        setStats(statsData);
      }

      // Fetch tier info
      const { data: tierData } = await supabase
        .from('p2p_merchant_tiers')
        .select('tier, max_pending_orders, max_order_amount, featured_ads_allowed')
        .eq('user_id', user.id)
        .single();

      if (tierData) {
        setTierInfo(tierData);
      }

      // Fetch active ads
      const { data: adsData } = await supabase
        .from('p2p_fiat_offers')
        .select('*')
        .eq('seller_id', user.id)
        .in('status', ['open', 'paused'])
        .order('created_at', { ascending: false });

      if (adsData) {
        setActiveAds(adsData);
      }

      // Fetch chart data - last 30 days trades
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: tradesData } = await supabase
        .from('p2p_fiat_trades')
        .select('created_at, fiat_amount, status')
        .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      // Group trades by day
      const tradesByDay: Record<string, { volume: number; trades: number }> = {};

      // Initialize all 30 days with 0
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        tradesByDay[dateKey] = { volume: 0, trades: 0 };
      }

      // Fill in actual data
      tradesData?.forEach((trade) => {
        const dateKey = new Date(trade.created_at).toISOString().split('T')[0];
        if (tradesByDay[dateKey]) {
          tradesByDay[dateKey].volume += trade.fiat_amount || 0;
          tradesByDay[dateKey].trades += 1;
        }
      });

      // Convert to array for chart
      const chartDataArray: ChartDataPoint[] = Object.entries(tradesByDay).map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        volume: data.volume,
        trades: data.trades
      }));

      setChartData(chartDataArray);
    } catch (error) {
      console.error('Error fetching merchant data:', error);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle ad status
  const toggleAdStatus = async (adId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'open' ? 'paused' : 'open';
      const { error } = await supabase
        .from('p2p_fiat_offers')
        .update({ status: newStatus })
        .eq('id', adId);

      if (error) throw error;

      toast.success(newStatus === 'open' ? t('p2pMerchant.adActivated') : t('p2pMerchant.adPaused'));
      fetchData();
    } catch (error) {
      console.error('Error toggling ad status:', error);
      toast.error(t('p2pMerchant.failedToUpdateStatus'));
    }
  };

  // Delete ad
  const deleteAd = async (adId: string) => {
    if (!confirm(t('p2pMerchant.confirmDelete'))) return;

    try {
      const { error } = await supabase
        .from('p2p_fiat_offers')
        .delete()
        .eq('id', adId);

      if (error) throw error;

      toast.success(t('p2pMerchant.adDeleted'));
      fetchData();
    } catch (error) {
      console.error('Error deleting ad:', error);
      toast.error(t('p2pMerchant.failedToDelete'));
    }
  };

  // Open edit modal with ad data
  const openEditModal = (ad: ActiveAd) => {
    setEditingAd(ad);
    setEditFiatAmount(ad.fiat_amount.toString());
    setEditMinOrder(ad.min_order_amount?.toString() || '');
    setEditMaxOrder(ad.max_order_amount?.toString() || '');
    setEditAdOpen(true);
  };

  // Save ad edits
  const saveAdEdit = async () => {
    if (!editingAd) return;

    const fiatAmt = parseFloat(editFiatAmount);
    if (!fiatAmt || fiatAmt <= 0) {
      toast.error(t('p2pMerchant.invalidFiatAmount'));
      return;
    }

    setSavingEdit(true);
    try {
      const updateData: Record<string, unknown> = {
        fiat_amount: fiatAmt,
        min_order_amount: editMinOrder ? parseFloat(editMinOrder) : null,
        max_order_amount: editMaxOrder ? parseFloat(editMaxOrder) : null,
      };

      const { error } = await supabase
        .from('p2p_fiat_offers')
        .update(updateData)
        .eq('id', editingAd.id);

      if (error) throw error;

      toast.success(t('p2pMerchant.adUpdated'));
      setEditAdOpen(false);
      setEditingAd(null);
      fetchData();
    } catch (error) {
      console.error('Error updating ad:', error);
      toast.error(t('p2pMerchant.failedToUpdate'));
    } finally {
      setSavingEdit(false);
    }
  };

  // Save auto-reply message
  const saveAutoReply = async () => {
    setSavingAutoReply(true);
    try {
      // Save to all active ads
      const { error } = await supabase
        .from('p2p_fiat_offers')
        .update({ auto_reply_message: autoReplyMessage })
        .eq('seller_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;

      toast.success(t('p2pMerchant.autoReplySaved'));
      setAutoReplyOpen(false);
    } catch (error) {
      console.error('Error saving auto-reply:', error);
      toast.error(t('p2pMerchant.failedToSaveAutoReply'));
    } finally {
      setSavingAutoReply(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-kurdish-green" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/p2p')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Crown className="h-6 w-6 text-kurdish-green" />
              {t('p2pMerchant.dashboardTitle')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('p2pMerchant.dashboardSubtitle')}
            </p>
          </div>
        </div>
        {tierInfo && <MerchantTierBadge tier={tierInfo.tier} size="lg" />}
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1">
            <BarChart3 className="h-4 w-4" />
            {t('p2pMerchant.tabOverview')}
          </TabsTrigger>
          <TabsTrigger value="ads" className="gap-1">
            <ShoppingBag className="h-4 w-4" />
            {t('p2pMerchant.tabAds')}
          </TabsTrigger>
          <TabsTrigger value="upgrade" className="gap-1">
            <TrendingUp className="h-4 w-4" />
            {t('p2pMerchant.tabUpgrade')}
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1">
            <Settings className="h-4 w-4" />
            {t('p2pMerchant.tabSettings')}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('p2pMerchant.thirtyDayVolumeLabel')}</p>
                    <p className="text-2xl font-bold">
                      ${stats?.total_volume_30d?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-kurdish-green/50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('p2pMerchant.thirtyDayTrades')}</p>
                    <p className="text-2xl font-bold">{stats?.total_trades_30d || 0}</p>
                  </div>
                  <ShoppingBag className="h-8 w-8 text-blue-500/50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('p2pMerchant.completionRateLabel')}</p>
                    <p className="text-2xl font-bold">
                      {stats?.completion_rate_30d?.toFixed(1) || '0'}%
                    </p>
                  </div>
                  <Star className="h-8 w-8 text-yellow-500/50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('p2pMerchant.avgReleaseTime')}</p>
                    <p className="text-2xl font-bold">
                      {stats?.avg_release_time_minutes || 0}m
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-purple-500/50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Volume Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('p2pMerchant.volumeTrend')}</CardTitle>
                <CardDescription>{t('p2pMerchant.last30dVolume')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="volume"
                      stroke="#00A94F"
                      fill="#00A94F"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Trades Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('p2pMerchant.tradeCount')}</CardTitle>
                <CardDescription>{t('p2pMerchant.dailyTrades30d')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))'
                      }}
                    />
                    <Bar dataKey="trades" fill="#00A94F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('p2pMerchant.lifetimeStats')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">
                    ${stats?.total_volume_lifetime?.toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-muted-foreground">{t('p2pMerchant.totalVolume')}</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{stats?.total_trades_lifetime || 0}</p>
                  <p className="text-sm text-muted-foreground">{t('p2pMerchant.totalTrades')}</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">
                    ${stats?.buy_volume_30d?.toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-muted-foreground">{t('p2pMerchant.buyVolume30d')}</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">
                    ${stats?.sell_volume_30d?.toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-muted-foreground">{t('p2pMerchant.sellVolume30d')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Ads Tab */}
        <TabsContent value="ads" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {t('p2pMerchant.activeAds', { count: activeAds.length })}
            </h2>
            <Button
              className="bg-kurdish-green hover:bg-kurdish-green-dark"
              onClick={() => setCreateAdOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('p2pMerchant.createNewAd')}
            </Button>
          </div>

          {activeAds.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground mb-4">
                  {t('p2pMerchant.noAdsYet')}
                </p>
                <Button onClick={() => setCreateAdOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t('p2pMerchant.createFirstAd')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeAds.map((ad) => (
                <Card key={ad.id} className="hover:border-kurdish-green/50 transition-colors">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={ad.status === 'open' ? 'default' : 'secondary'}>
                              {ad.status.toUpperCase()}
                            </Badge>
                            <span className="font-medium">
                              {t('p2pMerchant.sellTokenFor', { token: ad.token, currency: ad.fiat_currency })}
                            </span>
                            {ad.is_featured && (
                              <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                                <Star className="h-3 w-3 mr-1" />
                                {t('p2pMerchant.featured')}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {t('p2pMerchant.remaining', { remaining: ad.remaining_amount, total: ad.amount_crypto, token: ad.token })}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-medium">
                          {ad.price_per_unit?.toFixed(2)} {ad.fiat_currency}/{ad.token}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t('p2pMerchant.total', { amount: ad.fiat_amount?.toLocaleString(), currency: ad.fiat_currency })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleAdStatus(ad.id, ad.status)}
                          title={ad.status === 'open' ? t('p2pMerchant.pause') : t('p2pMerchant.activate')}
                        >
                          {ad.status === 'open' ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(ad)}
                          title={t('p2pMerchant.edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAd(ad.id)}
                          title={t('p2pMerchant.delete')}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Tier limits info */}
          {tierInfo && (
            <Card className="bg-muted/50">
              <CardContent className="py-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('p2pMerchant.activeAdsCount', { current: activeAds.filter(a => a.status === 'open').length, max: tierInfo.max_pending_orders })}
                  </span>
                  <span className="text-muted-foreground">
                    {t('p2pMerchant.maxOrderLimit', { amount: tierInfo.max_order_amount.toLocaleString() })}
                  </span>
                  <span className="text-muted-foreground">
                    {t('p2pMerchant.featuredAdsCount', { current: activeAds.filter(a => a.is_featured).length, max: tierInfo.featured_ads_allowed })}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Upgrade Tier Tab */}
        <TabsContent value="upgrade">
          <MerchantApplication />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          {/* Auto-reply */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t('p2pMerchant.autoReplyTitle')}
              </CardTitle>
              <CardDescription>
                {t('p2pMerchant.autoReplyDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => setAutoReplyOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                {t('p2pMerchant.configureAutoReply')}
              </Button>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('p2pMerchant.notificationSettings')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t('p2pMerchant.newOrderNotifications')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('p2pMerchant.newOrderNotificationsDesc')}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t('p2pMerchant.paymentNotifications')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('p2pMerchant.paymentNotificationsDesc')}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t('p2pMerchant.chatNotifications')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('p2pMerchant.chatNotificationsDesc')}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-lg text-destructive">{t('p2pMerchant.dangerZone')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t('p2pMerchant.pauseAllAds')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('p2pMerchant.pauseAllAdsDesc')}
                  </p>
                </div>
                <Button variant="outline">{t('p2pMerchant.pauseAll')}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Auto-reply Dialog */}
      <Dialog open={autoReplyOpen} onOpenChange={setAutoReplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('p2pMerchant.autoReplyDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('p2pMerchant.autoReplyDialogDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('p2pMerchant.messageLabel')}</Label>
              <Textarea
                value={autoReplyMessage}
                onChange={(e) => setAutoReplyMessage(e.target.value)}
                placeholder={t('p2pMerchant.autoReplyPlaceholder')}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoReplyOpen(false)}>
              {t('p2p.cancel')}
            </Button>
            <Button
              className="bg-kurdish-green hover:bg-kurdish-green-dark"
              onClick={saveAutoReply}
              disabled={savingAutoReply}
            >
              {savingAutoReply && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('p2pMerchant.saveMessage')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Ad Modal */}
      <Dialog open={createAdOpen} onOpenChange={setCreateAdOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('p2pMerchant.createNewOffer')}</DialogTitle>
            <DialogDescription>
              {t('p2pCreate.description')}
            </DialogDescription>
          </DialogHeader>
          <CreateAd onAdCreated={() => {
            setCreateAdOpen(false);
            fetchData();
          }} />
        </DialogContent>
      </Dialog>

      {/* Edit Ad Modal */}
      <Dialog open={editAdOpen} onOpenChange={setEditAdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('p2pMerchant.editAdTitle')}</DialogTitle>
            <DialogDescription>
              {t('p2pMerchant.editAdDesc')}
            </DialogDescription>
          </DialogHeader>
          {editingAd && (
            <div className="space-y-4">
              {/* Ad Info (Read-only) */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{t('p2pMerchant.adType')}</span>
                  <Badge variant={editingAd.ad_type === 'sell' ? 'default' : 'secondary'}>
                    {editingAd.ad_type === 'sell' ? t('p2pMerchant.selling') : t('p2pMerchant.buying')} {editingAd.token}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('p2p.amount')}</span>
                  <span className="font-medium">{editingAd.amount_crypto} {editingAd.token}</span>
                </div>
              </div>

              {/* Fiat Amount */}
              <div>
                <Label htmlFor="editFiatAmount">{t('p2pMerchant.totalFiatAmount', { currency: editingAd.fiat_currency })}</Label>
                <Input
                  id="editFiatAmount"
                  type="number"
                  step="0.01"
                  value={editFiatAmount}
                  onChange={(e) => setEditFiatAmount(e.target.value)}
                  placeholder={t('p2pMerchant.enterFiatAmount')}
                />
                {editFiatAmount && editingAd.amount_crypto > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('p2pMerchant.pricePerTokenCalc', { token: editingAd.token, price: (parseFloat(editFiatAmount) / editingAd.amount_crypto).toFixed(2), currency: editingAd.fiat_currency })}
                  </p>
                )}
              </div>

              {/* Order Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editMinOrder">{t('p2pMerchant.minOrderLabel', { token: editingAd.token })}</Label>
                  <Input
                    id="editMinOrder"
                    type="number"
                    step="0.01"
                    value={editMinOrder}
                    onChange={(e) => setEditMinOrder(e.target.value)}
                    placeholder={t('p2pMerchant.optional')}
                  />
                </div>
                <div>
                  <Label htmlFor="editMaxOrder">{t('p2pMerchant.maxOrderLabel', { token: editingAd.token })}</Label>
                  <Input
                    id="editMaxOrder"
                    type="number"
                    step="0.01"
                    value={editMaxOrder}
                    onChange={(e) => setEditMaxOrder(e.target.value)}
                    placeholder={t('p2pMerchant.optional')}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAdOpen(false)}>
              {t('p2p.cancel')}
            </Button>
            <Button
              className="bg-kurdish-green hover:bg-kurdish-green-dark"
              onClick={saveAdEdit}
              disabled={savingEdit}
            >
              {savingEdit && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('p2pMerchant.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
