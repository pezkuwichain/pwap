import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PlusCircle, Home, ClipboardList, TrendingUp, CheckCircle2, Clock, Store } from 'lucide-react';
import { AdList } from './AdList';
import { CreateAd } from './CreateAd';
import { NotificationBell } from './NotificationBell';
import { QuickFilterBar, DEFAULT_FILTERS, type P2PFilters } from './OrderFilters';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface UserStats {
  activeTrades: number;
  completedTrades: number;
  totalVolume: number;
}

export function P2PDashboard() {
  const [showCreateAd, setShowCreateAd] = useState(false);
  const [userStats, setUserStats] = useState<UserStats>({ activeTrades: 0, completedTrades: 0, totalVolume: 0 });
  const [filters, setFilters] = useState<P2PFilters>(DEFAULT_FILTERS);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch user stats
  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        // Count active trades
        const { count: activeCount } = await supabase
          .from('p2p_fiat_trades')
          .select('*', { count: 'exact', head: true })
          .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
          .in('status', ['pending', 'payment_sent']);

        // Count completed trades
        const { count: completedCount } = await supabase
          .from('p2p_fiat_trades')
          .select('*', { count: 'exact', head: true })
          .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
          .eq('status', 'completed');

        // Calculate total volume
        const { data: trades } = await supabase
          .from('p2p_fiat_trades')
          .select('fiat_amount')
          .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
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
  }, [user]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-white"
        >
          <Home className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Button
            variant="outline"
            onClick={() => navigate('/p2p/merchant')}
            className="border-gray-700 hover:bg-gray-800"
          >
            <Store className="w-4 h-4 mr-2" />
            Merchant
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/p2p/orders')}
            className="border-gray-700 hover:bg-gray-800"
          >
            <ClipboardList className="w-4 h-4 mr-2" />
            My Orders
            {userStats.activeTrades > 0 && (
              <Badge className="ml-2 bg-yellow-500 text-black">
                {userStats.activeTrades}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {user && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="py-4 flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{userStats.activeTrades}</p>
                <p className="text-sm text-gray-400">Active Trades</p>
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
                <p className="text-sm text-gray-400">Completed</p>
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
                <p className="text-sm text-gray-400">Volume</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white">P2P Trading</h1>
          <p className="text-gray-400">Buy and sell crypto with your local currency.</p>
        </div>
        <Button onClick={() => setShowCreateAd(true)}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Post a New Ad
        </Button>
      </div>

      {showCreateAd ? (
        <CreateAd onAdCreated={() => setShowCreateAd(false)} />
      ) : (
        <>
          {/* Quick Filter Bar */}
          <QuickFilterBar filters={filters} onFiltersChange={setFilters} />

          <Tabs defaultValue="buy">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="buy">Buy</TabsTrigger>
              <TabsTrigger value="sell">Sell</TabsTrigger>
              <TabsTrigger value="my-ads">My Ads</TabsTrigger>
            </TabsList>
            <TabsContent value="buy">
              <AdList type="buy" filters={filters} />
            </TabsContent>
            <TabsContent value="sell">
              <AdList type="sell" filters={filters} />
            </TabsContent>
            <TabsContent value="my-ads">
              <AdList type="my-ads" filters={filters} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
