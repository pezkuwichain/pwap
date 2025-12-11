import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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

      toast.success(`Ad ${newStatus === 'open' ? 'activated' : 'paused'}`);
      fetchData();
    } catch (error) {
      console.error('Error toggling ad status:', error);
      toast.error('Failed to update ad status');
    }
  };

  // Delete ad
  const deleteAd = async (adId: string) => {
    if (!confirm('Are you sure you want to delete this ad?')) return;

    try {
      const { error } = await supabase
        .from('p2p_fiat_offers')
        .delete()
        .eq('id', adId);

      if (error) throw error;

      toast.success('Ad deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Error deleting ad:', error);
      toast.error('Failed to delete ad');
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
      toast.error('Invalid fiat amount');
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

      toast.success('Ad updated successfully');
      setEditAdOpen(false);
      setEditingAd(null);
      fetchData();
    } catch (error) {
      console.error('Error updating ad:', error);
      toast.error('Failed to update ad');
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

      toast.success('Auto-reply message saved');
      setAutoReplyOpen(false);
    } catch (error) {
      console.error('Error saving auto-reply:', error);
      toast.error('Failed to save auto-reply');
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
              Merchant Dashboard
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage your P2P trading business
            </p>
          </div>
        </div>
        {tierInfo && <MerchantTierBadge tier={tierInfo.tier} size="lg" />}
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="ads" className="gap-1">
            <ShoppingBag className="h-4 w-4" />
            My Ads
          </TabsTrigger>
          <TabsTrigger value="upgrade" className="gap-1">
            <TrendingUp className="h-4 w-4" />
            Upgrade Tier
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1">
            <Settings className="h-4 w-4" />
            Settings
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
                    <p className="text-sm text-muted-foreground">30-Day Volume</p>
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
                    <p className="text-sm text-muted-foreground">30-Day Trades</p>
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
                    <p className="text-sm text-muted-foreground">Completion Rate</p>
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
                    <p className="text-sm text-muted-foreground">Avg Release Time</p>
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
                <CardTitle className="text-lg">Volume Trend</CardTitle>
                <CardDescription>Last 30 days trading volume</CardDescription>
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
                <CardTitle className="text-lg">Trade Count</CardTitle>
                <CardDescription>Daily trades over last 30 days</CardDescription>
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
              <CardTitle className="text-lg">Lifetime Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">
                    ${stats?.total_volume_lifetime?.toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Volume</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{stats?.total_trades_lifetime || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Trades</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">
                    ${stats?.buy_volume_30d?.toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-muted-foreground">Buy Volume (30d)</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">
                    ${stats?.sell_volume_30d?.toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-muted-foreground">Sell Volume (30d)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Ads Tab */}
        <TabsContent value="ads" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Active Advertisements ({activeAds.length})
            </h2>
            <Button
              className="bg-kurdish-green hover:bg-kurdish-green-dark"
              onClick={() => setCreateAdOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create New Ad
            </Button>
          </div>

          {activeAds.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground mb-4">
                  You don&apos;t have any active ads yet.
                </p>
                <Button onClick={() => setCreateAdOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Create Your First Ad
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
                              Sell {ad.token} for {ad.fiat_currency}
                            </span>
                            {ad.is_featured && (
                              <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                                <Star className="h-3 w-3 mr-1" />
                                Featured
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {ad.remaining_amount} / {ad.amount_crypto} {ad.token} remaining
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-medium">
                          {ad.price_per_unit?.toFixed(2)} {ad.fiat_currency}/{ad.token}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Total: {ad.fiat_amount?.toLocaleString()} {ad.fiat_currency}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleAdStatus(ad.id, ad.status)}
                          title={ad.status === 'open' ? 'Pause' : 'Activate'}
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
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAd(ad.id)}
                          title="Delete"
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
                    Active ads: {activeAds.filter(a => a.status === 'open').length} / {tierInfo.max_pending_orders}
                  </span>
                  <span className="text-muted-foreground">
                    Max order: ${tierInfo.max_order_amount.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">
                    Featured ads: {activeAds.filter(a => a.is_featured).length} / {tierInfo.featured_ads_allowed}
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
                Auto-Reply Message
              </CardTitle>
              <CardDescription>
                Automatically send this message when someone starts a trade with you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => setAutoReplyOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Configure Auto-Reply
              </Button>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notification Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">New Order Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified when someone accepts your offer
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Payment Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified when buyer marks payment as sent
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Chat Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified for new chat messages
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Pause All Ads</p>
                  <p className="text-sm text-muted-foreground">
                    Temporarily pause all your active advertisements
                  </p>
                </div>
                <Button variant="outline">Pause All</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Auto-reply Dialog */}
      <Dialog open={autoReplyOpen} onOpenChange={setAutoReplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Auto-Reply Message</DialogTitle>
            <DialogDescription>
              This message will be automatically sent when someone starts a trade with you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Message</Label>
              <Textarea
                value={autoReplyMessage}
                onChange={(e) => setAutoReplyMessage(e.target.value)}
                placeholder="Hello! Thank you for choosing to trade with me. Please follow the payment instructions and mark as paid once done."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoReplyOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-kurdish-green hover:bg-kurdish-green-dark"
              onClick={saveAutoReply}
              disabled={savingAutoReply}
            >
              {savingAutoReply && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Ad Modal */}
      <Dialog open={createAdOpen} onOpenChange={setCreateAdOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New P2P Offer</DialogTitle>
            <DialogDescription>
              Lock your crypto in escrow and set your price
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
            <DialogTitle>Edit Ad</DialogTitle>
            <DialogDescription>
              Update your ad price and order limits
            </DialogDescription>
          </DialogHeader>
          {editingAd && (
            <div className="space-y-4">
              {/* Ad Info (Read-only) */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Ad Type</span>
                  <Badge variant={editingAd.ad_type === 'sell' ? 'default' : 'secondary'}>
                    {editingAd.ad_type === 'sell' ? 'Selling' : 'Buying'} {editingAd.token}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="font-medium">{editingAd.amount_crypto} {editingAd.token}</span>
                </div>
              </div>

              {/* Fiat Amount */}
              <div>
                <Label htmlFor="editFiatAmount">Total Fiat Amount ({editingAd.fiat_currency})</Label>
                <Input
                  id="editFiatAmount"
                  type="number"
                  step="0.01"
                  value={editFiatAmount}
                  onChange={(e) => setEditFiatAmount(e.target.value)}
                  placeholder="Enter fiat amount"
                />
                {editFiatAmount && editingAd.amount_crypto > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Price per {editingAd.token}: {(parseFloat(editFiatAmount) / editingAd.amount_crypto).toFixed(2)} {editingAd.fiat_currency}
                  </p>
                )}
              </div>

              {/* Order Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editMinOrder">Min Order ({editingAd.token})</Label>
                  <Input
                    id="editMinOrder"
                    type="number"
                    step="0.01"
                    value={editMinOrder}
                    onChange={(e) => setEditMinOrder(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="editMaxOrder">Max Order ({editingAd.token})</Label>
                  <Input
                    id="editMaxOrder"
                    type="number"
                    step="0.01"
                    value={editMaxOrder}
                    onChange={(e) => setEditMaxOrder(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAdOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-kurdish-green hover:bg-kurdish-green-dark"
              onClick={saveAdEdit}
              disabled={savingEdit}
            >
              {savingEdit && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
