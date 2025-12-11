import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Copy,
  Upload,
  Shield,
  Zap,
  MessageSquare,
  Ban,
  ExternalLink,
  RefreshCw,
  Star,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePolkadot } from '@/contexts/PolkadotContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  markPaymentSent,
  confirmPaymentReceived,
  getUserReputation,
  type P2PFiatTrade,
  type P2PFiatOffer,
  type P2PReputation,
} from '@shared/lib/p2p-fiat';
import { TradeChat } from '@/components/p2p/TradeChat';
import { RatingModal } from '@/components/p2p/RatingModal';
import { DisputeModal } from '@/components/p2p/DisputeModal';

// Trade status type
type TradeStatus = 'pending' | 'payment_sent' | 'completed' | 'cancelled' | 'disputed' | 'refunded';

// Extended trade with offer details
interface TradeWithDetails extends P2PFiatTrade {
  offer?: P2PFiatOffer;
  seller_reputation?: P2PReputation;
  buyer_reputation?: P2PReputation;
  payment_method_name?: string;
  payment_details?: Record<string, string>;
}

// Timeline step interface
interface TimelineStep {
  id: string;
  label: string;
  description: string;
  status: 'completed' | 'current' | 'pending';
  timestamp?: string;
}

export default function P2PTrade() {
  const { tradeId } = useParams<{ tradeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { api, selectedAccount } = usePolkadot();

  const [trade, setTrade] = useState<TradeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  // Determine user role
  const isSeller = trade?.seller_id === user?.id;
  const isBuyer = trade?.buyer_id === user?.id;
  const isParticipant = isSeller || isBuyer;

  // Fetch trade details
  const fetchTrade = useCallback(async () => {
    if (!tradeId) return;

    try {
      // Fetch trade
      const { data: tradeData, error: tradeError } = await supabase
        .from('p2p_fiat_trades')
        .select('*')
        .eq('id', tradeId)
        .single();

      if (tradeError) throw tradeError;
      if (!tradeData) throw new Error('Trade not found');

      // Fetch offer details
      const { data: offerData } = await supabase
        .from('p2p_fiat_offers')
        .select('*')
        .eq('id', tradeData.offer_id)
        .single();

      // Fetch payment method
      let paymentMethodName = 'Unknown';
      let paymentDetails: Record<string, string> = {};
      if (offerData?.payment_method_id) {
        const { data: methodData } = await supabase
          .from('payment_methods')
          .select('method_name')
          .eq('id', offerData.payment_method_id)
          .single();
        paymentMethodName = methodData?.method_name || 'Unknown';

        // Decrypt payment details for buyer (only after trade starts)
        if (offerData.payment_details_encrypted && tradeData.status !== 'cancelled') {
          try {
            paymentDetails = JSON.parse(atob(offerData.payment_details_encrypted));
          } catch {
            paymentDetails = {};
          }
        }
      }

      // Fetch reputations
      const [sellerRep, buyerRep] = await Promise.all([
        getUserReputation(tradeData.seller_id),
        getUserReputation(tradeData.buyer_id),
      ]);

      setTrade({
        ...tradeData,
        offer: offerData || undefined,
        seller_reputation: sellerRep || undefined,
        buyer_reputation: buyerRep || undefined,
        payment_method_name: paymentMethodName,
        payment_details: paymentDetails,
      });
    } catch (error) {
      console.error('Fetch trade error:', error);
      toast.error('Failed to load trade details');
    } finally {
      setLoading(false);
    }
  }, [tradeId]);

  // Initial fetch
  useEffect(() => {
    fetchTrade();
  }, [fetchTrade]);

  // Real-time subscription
  useEffect(() => {
    if (!tradeId) return;

    const channel = supabase
      .channel(`trade-${tradeId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'p2p_fiat_trades',
          filter: `id=eq.${tradeId}`,
        },
        () => {
          fetchTrade();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tradeId, fetchTrade]);

  // Countdown timer
  useEffect(() => {
    if (!trade?.payment_deadline || trade.status !== 'pending') {
      setTimeRemaining(0);
      return;
    }

    const deadline = new Date(trade.payment_deadline).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((deadline - now) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0 && trade.status === 'pending') {
        // Auto-cancel logic could go here
        toast.warning('Payment deadline expired');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [trade?.payment_deadline, trade?.status]);

  // Format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return 'Expired';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get timeline steps
  const getTimelineSteps = (): TimelineStep[] => {
    const status = trade?.status as TradeStatus;
    const steps: TimelineStep[] = [
      {
        id: 'created',
        label: 'Order Created',
        description: 'Trade initiated',
        status: 'completed',
        timestamp: trade?.created_at,
      },
      {
        id: 'pending',
        label: 'Awaiting Payment',
        description: isBuyer ? 'Send payment to seller' : 'Waiting for buyer payment',
        status: status === 'pending' ? 'current' :
                ['payment_sent', 'completed'].includes(status) ? 'completed' : 'pending',
      },
      {
        id: 'payment_sent',
        label: 'Payment Sent',
        description: isSeller ? 'Verify and release crypto' : 'Waiting for confirmation',
        status: status === 'payment_sent' ? 'current' :
                status === 'completed' ? 'completed' : 'pending',
        timestamp: trade?.buyer_marked_paid_at,
      },
      {
        id: 'completed',
        label: 'Completed',
        description: 'Crypto released to buyer',
        status: status === 'completed' ? 'completed' : 'pending',
        timestamp: trade?.completed_at,
      },
    ];

    return steps;
  };

  // Handle mark as paid
  const handleMarkAsPaid = async () => {
    if (!trade || !user) return;

    setActionLoading(true);
    try {
      await markPaymentSent(trade.id, paymentProof || undefined);

      // Update payment reference if provided
      if (paymentReference) {
        await supabase
          .from('p2p_fiat_trades')
          .update({ buyer_payment_reference: paymentReference })
          .eq('id', trade.id);
      }

      setShowProofModal(false);
      setPaymentProof(null);
      setPaymentReference('');
      toast.success('Payment marked as sent');
      fetchTrade();
    } catch (error) {
      console.error('Mark as paid error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle release crypto
  const handleReleaseCrypto = async () => {
    if (!trade || !api || !selectedAccount) {
      toast.error('Please connect your wallet');
      return;
    }

    setActionLoading(true);
    try {
      await confirmPaymentReceived(api, selectedAccount, trade.id);
      toast.success('Crypto released to buyer!');
      fetchTrade();
    } catch (error) {
      console.error('Release crypto error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle cancel trade
  const handleCancelTrade = async () => {
    if (!trade) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('p2p_fiat_trades')
        .update({
          status: 'cancelled',
          cancelled_by: user?.id,
          cancel_reason: cancelReason,
        })
        .eq('id', trade.id);

      if (error) throw error;

      // Restore offer remaining amount
      await supabase
        .from('p2p_fiat_offers')
        .update({
          remaining_amount: (trade.offer?.remaining_amount || 0) + trade.crypto_amount,
          status: 'open',
        })
        .eq('id', trade.offer_id);

      setShowCancelModal(false);
      toast.success('Trade cancelled');
      fetchTrade();
    } catch (error) {
      console.error('Cancel trade error:', error);
      toast.error('Failed to cancel trade');
    } finally {
      setActionLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  // Render loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-green-500" />
        </div>
      </div>
    );
  }

  // Render not found
  if (!trade) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="py-12 text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Trade Not Found</h2>
            <p className="text-gray-400 mb-6">This trade does not exist or you do not have access.</p>
            <Button onClick={() => navigate('/p2p')}>Back to P2P</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get status color
  const getStatusColor = (status: TradeStatus) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'payment_sent': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'cancelled': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'disputed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'refunded': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const counterparty = isSeller ?
    { id: trade.buyer_id, wallet: trade.buyer_wallet, reputation: trade.buyer_reputation, label: 'Buyer' } :
    { id: trade.seller_id, wallet: trade.offer?.seller_wallet || '', reputation: trade.seller_reputation, label: 'Seller' };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/p2p/orders')}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          My Orders
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchTrade}
          className="text-gray-400 hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Trade Header Card */}
      <Card className="bg-gray-900 border-gray-800 mb-6">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle className="text-white">
                {isBuyer ? 'Buy' : 'Sell'} {trade.offer?.token || 'HEZ'}
              </CardTitle>
              <Badge className={getStatusColor(trade.status as TradeStatus)}>
                {trade.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            {trade.status === 'pending' && timeRemaining > 0 && (
              <div className="flex items-center gap-2 text-yellow-400">
                <Clock className="w-5 h-5" />
                <span className="text-xl font-mono font-bold">
                  {formatTimeRemaining(timeRemaining)}
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-400">Amount</p>
              <p className="text-lg font-semibold text-white">
                {trade.crypto_amount} {trade.offer?.token || 'HEZ'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Price</p>
              <p className="text-lg font-semibold text-green-400">
                {trade.fiat_amount.toFixed(2)} {trade.offer?.fiat_currency || 'TRY'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Unit Price</p>
              <p className="text-lg font-semibold text-white">
                {trade.price_per_unit.toFixed(2)} {trade.offer?.fiat_currency || 'TRY'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Payment Method</p>
              <p className="text-lg font-semibold text-white">
                {trade.payment_method_name}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card className="bg-gray-900 border-gray-800 mb-6">
        <CardHeader>
          <CardTitle className="text-white text-lg">Trade Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700" />

            {/* Steps */}
            <div className="space-y-6">
              {getTimelineSteps().map((step, index) => (
                <div key={step.id} className="relative flex items-start gap-4">
                  {/* Icon */}
                  <div className={`
                    relative z-10 w-8 h-8 rounded-full flex items-center justify-center
                    ${step.status === 'completed' ? 'bg-green-500' :
                      step.status === 'current' ? 'bg-yellow-500' : 'bg-gray-700'}
                  `}>
                    {step.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : step.status === 'current' ? (
                      <Clock className="w-5 h-5 text-white" />
                    ) : (
                      <span className="text-gray-400 text-sm">{index + 1}</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-2">
                    <p className={`font-medium ${
                      step.status === 'completed' ? 'text-green-400' :
                      step.status === 'current' ? 'text-yellow-400' : 'text-gray-500'
                    }`}>
                      {step.label}
                    </p>
                    <p className="text-sm text-gray-400">{step.description}</p>
                    {step.timestamp && (
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(step.timestamp).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Counterparty Info */}
      <Card className="bg-gray-900 border-gray-800 mb-6">
        <CardHeader>
          <CardTitle className="text-white text-lg">{counterparty.label} Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-green-500/20 text-green-400 text-lg">
                {counterparty.wallet.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-white">
                  {counterparty.wallet.slice(0, 8)}...{counterparty.wallet.slice(-6)}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => copyToClipboard(counterparty.wallet, 'Address')}
                >
                  <Copy className="w-3 h-3" />
                </Button>
                {counterparty.reputation?.verified_merchant && (
                  <Shield className="w-4 h-4 text-blue-400" title="Verified Merchant" />
                )}
                {counterparty.reputation?.fast_trader && (
                  <Zap className="w-4 h-4 text-yellow-400" title="Fast Trader" />
                )}
              </div>
              {counterparty.reputation && (
                <p className="text-sm text-gray-400">
                  {counterparty.reputation.completed_trades} trades •
                  {' '}{((counterparty.reputation.completed_trades / (counterparty.reputation.total_trades || 1)) * 100).toFixed(0)}% completion
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Details (Buyer only, when trade is active) */}
      {isBuyer && trade.status === 'pending' && trade.payment_details && Object.keys(trade.payment_details).length > 0 && (
        <Card className="bg-gray-900 border-gray-800 mb-6">
          <CardHeader>
            <CardTitle className="text-white text-lg">Payment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="bg-yellow-500/10 border-yellow-500/30 mb-4">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-200">
                Send exactly <strong>{trade.fiat_amount.toFixed(2)} {trade.offer?.fiat_currency}</strong> to the account below.
                Do not include any cryptocurrency references in your payment.
              </AlertDescription>
            </Alert>
            <div className="space-y-3">
              {Object.entries(trade.payment_details).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-400">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    <p className="text-white font-medium">{value}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(value, key)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Proof (if uploaded) */}
      {trade.buyer_payment_proof_url && (
        <Card className="bg-gray-900 border-gray-800 mb-6">
          <CardHeader>
            <CardTitle className="text-white text-lg">Payment Proof</CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={trade.buyer_payment_proof_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
            >
              <ExternalLink className="w-4 h-4" />
              View Payment Proof
            </a>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {isParticipant && !['completed', 'cancelled', 'refunded'].includes(trade.status) && (
        <Card className="bg-gray-900 border-gray-800 mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Buyer Actions */}
              {isBuyer && trade.status === 'pending' && (
                <>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => setShowProofModal(true)}
                    disabled={actionLoading}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    I Have Paid
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-gray-700"
                    onClick={() => setShowCancelModal(true)}
                    disabled={actionLoading}
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Cancel Trade
                  </Button>
                </>
              )}

              {/* Seller Actions */}
              {isSeller && trade.status === 'payment_sent' && (
                <>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={handleReleaseCrypto}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Release Crypto
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                    onClick={() => setShowDisputeModal(true)}
                    disabled={actionLoading}
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Open Dispute
                  </Button>
                </>
              )}

              {/* Chat Button */}
              <Button
                variant="outline"
                className="border-gray-700"
                onClick={() => setShowChat(!showChat)}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                {showChat ? 'Hide Chat' : 'Chat'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chat Section */}
      {showChat && isParticipant && (
        <div className="mb-6">
          <TradeChat
            tradeId={tradeId!}
            counterpartyId={counterparty.id}
            counterpartyWallet={counterparty.wallet}
            isTradeActive={!['completed', 'cancelled', 'refunded'].includes(trade.status)}
          />
        </div>
      )}

      {/* Completed Message */}
      {trade.status === 'completed' && (
        <Card className="bg-green-500/10 border-green-500/30 mb-6">
          <CardContent className="py-6 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-green-400 mb-2">Trade Completed!</h3>
            <p className="text-gray-400 mb-4">
              {isBuyer
                ? `You received ${trade.crypto_amount} ${trade.offer?.token}`
                : `You received ${trade.fiat_amount.toFixed(2)} ${trade.offer?.fiat_currency}`
              }
            </p>
            <Button
              onClick={() => setShowRatingModal(true)}
              className="bg-yellow-500 hover:bg-yellow-600 text-black"
            >
              <Star className="w-4 h-4 mr-2" />
              Rate This Trade
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Cancelled Message */}
      {trade.status === 'cancelled' && (
        <Card className="bg-gray-500/10 border-gray-500/30 mb-6">
          <CardContent className="py-6 text-center">
            <XCircle className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">Trade Cancelled</h3>
            {trade.cancel_reason && (
              <p className="text-gray-500">Reason: {trade.cancel_reason}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mark as Paid Modal */}
      <Dialog open={showProofModal} onOpenChange={setShowProofModal}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Confirm Payment</DialogTitle>
            <DialogDescription className="text-gray-400">
              Please confirm you have sent the payment to the seller.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="reference">Payment Reference (Optional)</Label>
              <Input
                id="reference"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Transaction ID or reference number"
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div>
              <Label>Payment Proof (Optional)</Label>
              <div className="mt-2">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-700 border-dashed rounded-lg cursor-pointer hover:bg-gray-800">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-400">
                      {paymentProof ? paymentProof.name : 'Click to upload screenshot'}
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => setPaymentProof(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>
            <Alert className="bg-yellow-500/10 border-yellow-500/30">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-200">
                Only click confirm after you have actually sent the payment.
                Falsely marking payment as sent may result in account suspension.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowProofModal(false)}
              disabled={actionLoading}
              className="border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleMarkAsPaid}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Confirm Payment Sent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Trade Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Cancel Trade</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to cancel this trade? The crypto will be returned to the seller.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="cancelReason">Reason for cancellation</Label>
            <Input
              id="cancelReason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Optional reason"
              className="bg-gray-800 border-gray-700 mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelModal(false)}
              disabled={actionLoading}
              className="border-gray-700"
            >
              Keep Trade
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelTrade}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Cancel Trade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rating Modal */}
      <RatingModal
        isOpen={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        tradeId={tradeId!}
        counterpartyId={counterparty.id}
        counterpartyWallet={counterparty.wallet}
        isBuyer={isBuyer}
      />

      {/* Dispute Modal */}
      <DisputeModal
        isOpen={showDisputeModal}
        onClose={() => setShowDisputeModal(false)}
        tradeId={tradeId!}
        counterpartyId={counterparty.id}
        counterpartyWallet={counterparty.wallet}
        isBuyer={isBuyer}
      />
    </div>
  );
}
