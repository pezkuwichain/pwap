import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { type P2PFiatTrade, type P2PFiatOffer } from '@shared/lib/p2p-fiat';

// Trade status type
type TradeStatus = 'pending' | 'payment_sent' | 'completed' | 'cancelled' | 'disputed' | 'refunded';

// Extended trade with offer details
interface TradeWithOffer extends P2PFiatTrade {
  offer?: P2PFiatOffer;
}

export default function P2POrders() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [trades, setTrades] = useState<TradeWithOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');

  // Fetch user's trades
  const fetchTrades = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch all trades where user is buyer or seller
      const { data: tradesData, error } = await supabase
        .from('p2p_fiat_trades')
        .select('*')
        .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch offer details for each trade
      const tradesWithOffers = await Promise.all(
        (tradesData || []).map(async (trade) => {
          const { data: offerData } = await supabase
            .from('p2p_fiat_offers')
            .select('*')
            .eq('id', trade.offer_id)
            .single();

          return {
            ...trade,
            offer: offerData || undefined,
          };
        })
      );

      setTrades(tradesWithOffers);
    } catch (error) {
      console.error('Fetch trades error:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Filter trades by status
  const activeTrades = trades.filter(t =>
    ['pending', 'payment_sent', 'disputed'].includes(t.status)
  );
  const completedTrades = trades.filter(t => t.status === 'completed');
  const cancelledTrades = trades.filter(t =>
    ['cancelled', 'refunded'].includes(t.status)
  );

  // Get status badge
  const getStatusBadge = (status: TradeStatus) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Awaiting Payment
          </Badge>
        );
      case 'payment_sent':
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Payment Sent
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Cancelled
          </Badge>
        );
      case 'disputed':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Disputed
          </Badge>
        );
      case 'refunded':
        return (
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
            <RefreshCw className="w-3 h-3 mr-1" />
            Refunded
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Render trade card
  const renderTradeCard = (trade: TradeWithOffer) => {
    const isBuyer = trade.buyer_id === user?.id;
    const counterpartyWallet = isBuyer
      ? trade.offer?.seller_wallet || 'Unknown'
      : trade.buyer_wallet;

    const timeAgo = (date: string) => {
      const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
      if (seconds < 60) return 'Just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    };

    return (
      <Card
        key={trade.id}
        className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors cursor-pointer"
        onClick={() => navigate(`/p2p/trade/${trade.id}`)}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Direction Icon */}
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center
              ${isBuyer ? 'bg-green-500/20' : 'bg-red-500/20'}
            `}>
              {isBuyer ? (
                <ArrowDownLeft className="w-5 h-5 text-green-400" />
              ) : (
                <ArrowUpRight className="w-5 h-5 text-red-400" />
              )}
            </div>

            {/* Trade Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`font-semibold ${isBuyer ? 'text-green-400' : 'text-red-400'}`}>
                  {isBuyer ? 'Buy' : 'Sell'}
                </span>
                <span className="text-white font-medium">
                  {trade.crypto_amount} {trade.offer?.token || 'HEZ'}
                </span>
                {getStatusBadge(trade.status as TradeStatus)}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="bg-gray-700 text-xs">
                    {counterpartyWallet.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">
                  {counterpartyWallet.slice(0, 8)}...{counterpartyWallet.slice(-4)}
                </span>
                <span className="text-gray-500">•</span>
                <span>{timeAgo(trade.created_at)}</span>
              </div>
            </div>

            {/* Amount */}
            <div className="text-right">
              <p className="text-lg font-semibold text-white">
                {trade.fiat_amount.toFixed(2)} {trade.offer?.fiat_currency || 'TRY'}
              </p>
              <p className="text-sm text-gray-400">
                @ {trade.price_per_unit.toFixed(2)}/{trade.offer?.token || 'HEZ'}
              </p>
            </div>
          </div>

          {/* Deadline warning for pending trades */}
          {trade.status === 'pending' && trade.payment_deadline && (
            <div className="mt-3 pt-3 border-t border-gray-800">
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <Clock className="w-4 h-4" />
                <span>
                  Payment deadline: {new Date(trade.payment_deadline).toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render empty state
  const renderEmptyState = (message: string) => (
    <div className="text-center py-12">
      <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
      <p className="text-gray-400">{message}</p>
    </div>
  );

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Login Required</h2>
            <p className="text-gray-400 mb-6">Please log in to view your P2P orders.</p>
            <Button onClick={() => navigate('/login')}>Log In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/p2p')}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          P2P Trading
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchTrades}
          disabled={loading}
          className="text-gray-400 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">My Orders</h1>
        <p className="text-gray-400">View and manage your P2P trades</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{activeTrades.length}</p>
            <p className="text-sm text-gray-400">Active</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-green-400">{completedTrades.length}</p>
            <p className="text-sm text-gray-400">Completed</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-gray-400">{cancelledTrades.length}</p>
            <p className="text-sm text-gray-400">Cancelled</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="active" className="relative">
            Active
            {activeTrades.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-500 text-black rounded-full">
                {activeTrades.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-green-500" />
          </div>
        ) : (
          <>
            <TabsContent value="active" className="space-y-4">
              {activeTrades.length === 0
                ? renderEmptyState('No active trades')
                : activeTrades.map(renderTradeCard)
              }
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {completedTrades.length === 0
                ? renderEmptyState('No completed trades')
                : completedTrades.map(renderTradeCard)
              }
            </TabsContent>

            <TabsContent value="cancelled" className="space-y-4">
              {cancelledTrades.length === 0
                ? renderEmptyState('No cancelled trades')
                : cancelledTrades.map(renderTradeCard)
              }
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
