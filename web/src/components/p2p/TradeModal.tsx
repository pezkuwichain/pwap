import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Clock } from 'lucide-react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useP2PIdentity } from '@/contexts/P2PIdentityContext';
import { toast } from 'sonner';
import { acceptFiatOffer, type P2PFiatOffer } from '@shared/lib/p2p-fiat';

interface TradeModalProps {
  offer: P2PFiatOffer;
  onClose: () => void;
}

export function TradeModal({ offer, onClose }: TradeModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedAccount } = usePezkuwi();
  const { userId } = useP2PIdentity();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const cryptoAmount = parseFloat(amount) || 0;
  const fiatAmount = cryptoAmount * offer.price_per_unit;
  const isValidAmount = cryptoAmount > 0 && cryptoAmount <= offer.remaining_amount;
  
  // Check min/max order amounts
  const meetsMinOrder = !offer.min_order_amount || cryptoAmount >= offer.min_order_amount;
  const meetsMaxOrder = !offer.max_order_amount || cryptoAmount <= offer.max_order_amount;

  const handleInitiateTrade = async () => {
    if (!selectedAccount || !userId) {
      toast.error(t('p2p.connectWalletAndLogin'));
      return;
    }

    // Prevent self-trading
    if (offer.seller_id === userId) {
      toast.error(t('p2pTrade.cannotTradeOwn'));
      return;
    }

    if (!isValidAmount) {
      toast.error(t('p2pTrade.invalidAmount'));
      return;
    }

    if (!meetsMinOrder) {
      toast.error(t('p2p.minOrder', { amount: offer.min_order_amount, token: offer.token }));
      return;
    }

    if (!meetsMaxOrder) {
      toast.error(t('p2p.maxOrder', { amount: offer.max_order_amount, token: offer.token }));
      return;
    }

    setLoading(true);

    try {
      const tradeId = await acceptFiatOffer({
        offerId: offer.id,
        buyerUserId: userId,
        buyerWallet: selectedAccount.address,
        amount: cryptoAmount
      });

      toast.success(t('p2pTrade.tradeInitiated'));
      onClose();

      // Navigate to trade page
      navigate(`/p2p/trade/${tradeId}`);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Accept offer error:', error);
      // Error toast already shown in acceptFiatOffer
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>{t('p2pTrade.buyToken', { token: offer.token })}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {t('p2pTrade.tradingWith', { address: `${offer.seller_wallet.slice(0, 6)}...${offer.seller_wallet.slice(-4)}` })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Price Info */}
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">{t('p2p.price')}</span>
              <span className="text-xl font-bold text-green-400">
                {offer.price_per_unit.toFixed(2)} {offer.fiat_currency}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">{t('p2p.available')}</span>
              <span className="text-white">{offer.remaining_amount} {offer.token}</span>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <Label htmlFor="buyAmount">{t('p2pTrade.amountToBuy', { token: offer.token })}</Label>
            <Input
              id="buyAmount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('p2p.amount')}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 placeholder:opacity-50"
            />
            {offer.min_order_amount && (
              <p className="text-xs text-gray-500 mt-1">
                {t('p2p.minLimit', { amount: offer.min_order_amount, token: offer.token })}
              </p>
            )}
            {offer.max_order_amount && (
              <p className="text-xs text-gray-500 mt-1">
                {t('p2p.maxLimit', { amount: offer.max_order_amount, token: offer.token })}
              </p>
            )}
          </div>

          {/* Calculation */}
          {cryptoAmount > 0 && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-sm text-gray-400 mb-1">{t('p2pTrade.youWillPay')}</p>
              <p className="text-2xl font-bold text-green-400">
                {fiatAmount.toFixed(2)} {offer.fiat_currency}
              </p>
            </div>
          )}

          {/* Warnings */}
          {!meetsMinOrder && cryptoAmount > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('p2p.minOrder', { amount: offer.min_order_amount, token: offer.token })}
              </AlertDescription>
            </Alert>
          )}

          {!meetsMaxOrder && cryptoAmount > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('p2p.maxOrder', { amount: offer.max_order_amount, token: offer.token })}
              </AlertDescription>
            </Alert>
          )}

          {/* Payment Time Limit */}
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              {t('p2pTrade.paymentDeadline', { minutes: offer.time_limit_minutes })}
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={loading}
            className="bg-gray-800 border-gray-700 hover:bg-gray-700"
          >
            {t('p2p.cancel')}
          </Button>
          <Button 
            onClick={handleInitiateTrade}
            disabled={!isValidAmount || !meetsMinOrder || !meetsMaxOrder || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('p2pTrade.initiating')}
              </>
            ) : (
              t('p2pTrade.acceptAndContinue')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
